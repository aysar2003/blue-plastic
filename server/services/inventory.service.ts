import 'server-only'

import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import type {
  InventoryAdjustmentInput,
  StoreTicketInput,
  StoreTransferInput,
} from '@/lib/validation/inventory'
import {
  positionsOf,
  recordMovement,
  reverseMovementsFor,
  stockAgreesWithLedger,
  valuation,
} from '@/server/accounting/inventory'
import { systemAccountId } from '@/server/accounting/chart-of-accounts'
import * as accountService from '@/server/services/account.service'
import * as storeService from '@/server/services/store.service'
import { softDeleteDocument } from '@/server/accounting/deletion'
import { postJournal } from '@/server/accounting/posting'
import type { DraftLine } from '@/server/accounting/posting'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import type { StockAlert } from '@/lib/stock-alert'
import { notFound, precondition, validation } from '@/server/errors'
import { assignDocumentNumber, numberTaken } from '@/server/sequences'

/** Stock on hand, valued, with reorder flags. */
export async function stockOnHand(ctx: OrgContext) {
  return valuation(db as unknown as Tx, ctx.orgId)
}

/** Out of stock first, then products that have reached the limit set for ordering. */
export async function listStockAlerts(ctx: OrgContext): Promise<StockAlert[]> {
  const stock = await stockOnHand(ctx)
  const alerts: StockAlert[] = []
  for (const item of stock.items) {
    const quantity = item.quantity.toFixed(2)
    const reorderPoint = item.reorderPoint ? item.reorderPoint.toFixed(2) : null
    if (item.quantity.lessThanOrEqualTo(0)) {
      alerts.push({ itemId: item.itemId, name: item.name, quantity, reorderPoint, kind: 'out' })
    } else if (item.belowReorder) {
      alerts.push({ itemId: item.itemId, name: item.name, quantity, reorderPoint, kind: 'limit' })
    }
  }
  alerts.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'out' ? -1 : 1))
  return alerts
}

/** Does the stock ledger agree with the Inventory Asset account? */
export async function agreement(ctx: OrgContext) {
  return stockAgreesWithLedger(db as unknown as Tx, ctx.orgId)
}

/** Every movement of one item, oldest first, as a register. */
export async function movementsFor(ctx: OrgContext, itemId: string, limit = 200) {
  const rows = await db.inventoryTransaction.findMany({
    where: { orgId: ctx.orgId, itemId },
    orderBy: { sequence: 'asc' },
    take: limit,
    select: {
      id: true, date: true, type: true, quantity: true, unitCost: true, value: true,
      runningQuantity: true, runningValue: true, sequence: true,
      journal: { select: { id: true, journalNumber: true } },
    },
  })

  return rows.map((row) => ({
    ...row,
    quantity: new Decimal(row.quantity.toString()),
    unitCost: new Decimal(row.unitCost.toString()),
    value: new Decimal(row.value.toString()),
    runningQuantity: new Decimal(row.runningQuantity.toString()),
    runningValue: new Decimal(row.runningValue.toString()),
  }))
}

export async function listAdjustments(ctx: OrgContext) {
  return db.inventoryAdjustment
    .findMany({
      where: { orgId: ctx.orgId },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      take: 100,
      select: {
        id: true, number: true, date: true, memo: true, reason: true, status: true,
        journalId: true, voidedAt: true, voidReason: true,
        account: { select: { code: true, name: true } },
        journal: { select: { id: true, journalNumber: true } },
        lines: { select: { value: true, quantityChange: true } },
      },
    })
    .then((rows) =>
      rows.map((row) => ({
        ...row,
        totalValue: row.lines.reduce((sum, line) => sum.plus(line.value.toString()), ZERO),
        lineCount: row.lines.length,
      })),
    )
}

export async function getAdjustment(ctx: OrgContext, id: string) {
  const adjustment = await db.inventoryAdjustment.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true, number: true, date: true, memo: true, reason: true, status: true,
      account: { select: { id: true, code: true, name: true } },
      journal: { select: { id: true, journalNumber: true } },
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true, lineNumber: true, countedQuantity: true, previousQuantity: true,
          quantityChange: true, unitCost: true, value: true, description: true,
          item: { select: { id: true, name: true, sku: true } },
        },
      },
    },
  })
  if (!adjustment) throw notFound('Adjustment')

  return {
    ...adjustment,
    lines: adjustment.lines.map((line) => ({
      ...line,
      countedQuantity: line.countedQuantity.toString(),
      previousQuantity: line.previousQuantity.toString(),
      quantityChange: line.quantityChange.toString(),
      unitCost: line.unitCost.toString(),
      value: line.value.toString(),
    })),
  }
}

/**
 * Adjust stock to what a count found.
 *
 * The document records what the books said, what the count says, and the
 * difference — so it can be read years later without recomputing history. The
 * difference in value goes to Inventory Shrinkage: stock that has gone missing
 * is an expense, and burying it in cost of goods sold would flatter the margin on
 * everything that actually sold.
 */
/** The expense account a damage adjustment uses when no other account is chosen. */
export async function ensureDamageAccount(ctx: OrgContext): Promise<string> {
  const existing = await db.ledgerAccount.findFirst({
    where: { orgId: ctx.orgId, name: 'Inventory Damage and Loss', isActive: true },
    select: { id: true },
  })
  if (existing) return existing.id

  const codes = await db.ledgerAccount.findMany({
    where: { orgId: ctx.orgId },
    select: { code: true },
  })
  const used = new Set(codes.map((row) => row.code))
  let number = 5300
  while (used.has(String(number))) number += 1

  const account = await accountService.create(ctx, {
    code: String(number),
    name: 'Inventory Damage and Loss',
    description: 'Where the cost goes when damaged stock is written off. A partial loss can instead stay on the item, which raises its cost.',
    type: 'EXPENSE',
    subtype: 'COST_OF_GOODS_SOLD',
    detailType: 'Inventory damage',
  })
  return account.id
}

export async function createAdjustment(ctx: OrgContext, input: InventoryAdjustmentInput) {
  const meta = await requestMeta()
  const mode = input.mode ?? 'count'
  const accountId =
    input.accountId ?? (mode === 'damage' ? await ensureDamageAccount(ctx) : null)

  return db.$transaction(async (tx) => {
    const account = accountId
      ? await tx.ledgerAccount.findFirst({
          where: { id: accountId, orgId: ctx.orgId, isActive: true },
          select: { id: true, name: true, type: true },
        })
      : { id: await systemAccountId(tx, ctx.orgId, 'INVENTORY_SHRINKAGE'), name: '', type: 'EXPENSE' }

    if (!account) throw notFound('Account')
    if (account.type !== 'EXPENSE' && account.type !== 'REVENUE') {
      throw validation(
        `"${account.name}" is not an expense or income account, so a stock difference cannot go there.`,
        { accountId: ['Choose an expense account, normally Inventory Shrinkage'] },
      )
    }

    const items = await tx.item.findMany({
      where: { id: { in: input.lines.map((line) => line.itemId) }, orgId: ctx.orgId },
      select: { id: true, name: true, type: true, inventoryAccountId: true },
    })
    const byId = new Map(items.map((item) => [item.id, item]))

    for (const line of input.lines) {
      const item = byId.get(line.itemId)
      if (!item) throw notFound('Item')
      if (item.type !== 'INVENTORY') {
        throw validation(`"${item.name}" is not a tracked item, so it has no stock to adjust.`)
      }
      if (!item.inventoryAccountId) {
        throw precondition(`"${item.name}" has no inventory account.`)
      }
    }

    const positions = await positionsOf(tx, ctx.orgId, input.lines.map((line) => line.itemId))
    const number = await assignDocumentNumber(tx, ctx.orgId, 'INVENTORY_ADJUSTMENT', input.number)
    const clash = await tx.inventoryAdjustment.findFirst({
      where: { orgId: ctx.orgId, number },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    const adjustment = await tx.inventoryAdjustment.create({
      data: {
        orgId: ctx.orgId,
        number,
        date: toDate(input.date),
        accountId: account.id,
        memo: input.memo ?? null,
        reason: input.reason ?? null,
        createdById: ctx.userId,
      },
      select: { id: true, number: true },
    })

    const stockLines = new Map<string, Decimal>()
    let totalValue = ZERO
    let lineNumber = 0

    for (const line of input.lines) {
      const item = byId.get(line.itemId)!
      const position = positions.get(line.itemId)!
      const entered = new Decimal(line.countedQuantity)
      const counted = mode === 'damage' ? position.quantity.minus(entered) : mode === 'cost' ? position.quantity : entered
      const change = counted.minus(position.quantity)

      if (mode === 'damage' && !entered.isPositive()) {
        throw validation(`Enter how many of "${item.name}" were damaged or lost.`)
      }
      if (mode === 'cost' && !entered.isPositive()) continue
      if (mode !== 'cost' && change.isZero()) continue

      const movement = await recordMovement(tx, ctx, {
        itemId: line.itemId,
        date: input.date,
        type: 'ADJUSTMENT',
        sourceType: 'INVENTORY_ADJUSTMENT',
        sourceId: adjustment.id,
        quantity: mode === 'cost' ? 0 : change,
        // A count values found stock at the current average. Damage leaves the
        // value on whatever is still there, so that cost rises. Adding cost
        // posts the amount onto the item without changing the quantity.
        unitCost:
          mode === 'count' && change.isPositive()
            ? (line.unitCost ?? (position.averageCost.isZero() ? '0' : position.averageCost))
            : undefined,
        valueOverride: mode === 'damage' ? 0 : mode === 'cost' ? entered : undefined,
      })

      await tx.inventoryAdjustmentLine.create({
        data: {
          orgId: ctx.orgId,
          adjustmentId: adjustment.id,
          lineNumber: ++lineNumber,
          itemId: line.itemId,
          countedQuantity: counted.toFixed(4),
          previousQuantity: position.quantity.toFixed(4),
          quantityChange: change.toFixed(4),
          unitCost: movement.unitCost.toFixed(6),
          value: movement.value.toFixed(4),
          description: line.description ?? null,
        },
      })

      stockLines.set(
        item.inventoryAccountId!,
        (stockLines.get(item.inventoryAccountId!) ?? ZERO).plus(movement.value),
      )
      totalValue = totalValue.plus(movement.value)
    }

    if (lineNumber === 0) {
      throw validation('Nothing has changed — every count matches what the books already say.')
    }

    // Stock up means the asset rises and the difference is a credit to shrinkage
    // (a recovery); stock down means the asset falls and shrinkage is charged.
    const lines: DraftLine[] = []
    for (const [inventoryAccountId, value] of stockLines) {
      if (value.isZero()) continue
      lines.push(
        value.isPositive()
          ? { accountId: inventoryAccountId, debit: value, description: 'Stock adjustment' }
          : { accountId: inventoryAccountId, credit: value.abs(), description: 'Stock adjustment' },
      )
    }
    if (!totalValue.isZero()) {
      lines.push(
        totalValue.isPositive()
          ? { accountId: account.id, credit: totalValue, description: input.reason ?? 'Stock adjustment' }
          : { accountId: account.id, debit: totalValue.abs(), description: input.reason ?? 'Stock adjustment' },
      )
    }

    if (lines.length >= 2) {
      const journal = await postJournal(tx, ctx, {
        date: input.date,
        memo: `Stock adjustment ${adjustment.number}${input.reason ? ` — ${input.reason}` : ''}`,
        sourceType: 'INVENTORY_ADJUSTMENT',
        sourceId: adjustment.id,
        lines,
      })

      await tx.inventoryAdjustment.update({
        where: { id: adjustment.id },
        data: { journalId: journal.id },
      })
      await tx.inventoryTransaction.updateMany({
        where: { orgId: ctx.orgId, sourceId: adjustment.id, journalId: null },
        data: { journalId: journal.id },
      })
    }

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'InventoryAdjustment',
        entityId: adjustment.id,
        action: 'CREATE',
        after: { number: adjustment.number, lines: lineNumber, value: totalValue.toString() },
      },
      meta,
    )

    return { id: adjustment.id, number: adjustment.number }
  })
}

/**
 * Void a stock adjustment.
 *
 * A count entered against the wrong item is the commonest mistake in stock
 * keeping, and until now there was no way back from it. Voiding reverses the
 * journal and puts the stock back exactly as it was — the movements are undone
 * by their opposites rather than deleted, so the register still reads as "this
 * was counted, then it was undone", which is what an auditor needs to see.
 */
/**
 * Delete a stock adjustment.
 *
 * The count it recorded is undone by appending the opposite movement — the stock
 * ledger's running totals mean a row cannot simply stop counting — and its
 * journal is withdrawn, so the Inventory Asset account and the stock ledger fall
 * by the same amount and still agree.
 *
 * Nothing is physically removed. See `server/accounting/deletion.ts`.
 */
export async function removeAdjustment(ctx: OrgContext, id: string, reason?: string | null) {
  return db.$transaction(async (tx) => {
    const adjustment = await tx.inventoryAdjustment.findFirst({
      where: { id, orgId: ctx.orgId, deletedAt: undefined },
      select: { id: true, number: true, status: true, journalId: true, deletedAt: true },
    })
    if (!adjustment) throw notFound('Adjustment')
    if (adjustment.deletedAt) return { id, number: adjustment.number }

    await reverseMovementsFor(tx, ctx, { sourceId: id })

    return softDeleteDocument(tx, ctx, {
      mark: (stamp) => tx.inventoryAdjustment.update({ where: { id }, data: stamp }),
      entity: 'InventoryAdjustment',
      id,
      number: adjustment.number,
      journalIds: [adjustment.journalId],
      reason,
      before: { status: adjustment.status },
    })
  })
}

/** Items that have fallen to or below their reorder point. */
export async function reorderReport(ctx: OrgContext) {
  const stock = await stockOnHand(ctx)
  return stock.items.filter((item) => item.belowReorder)
}

type TransferTicketOptions = {
  /** AUTO on the transfer form; MANUAL on the ticket form. */
  ticketOrigin?: 'AUTO' | 'MANUAL'
  ticketNumber?: string | null
  takenBy?: string | null
}

/**
 * Move stock from one store to another.
 *
 * Global quantity and average cost stay the same. Value leaves the source
 * store's inventory account and lands on the destination store's account.
 * A store ticket (TKT-) is always written for the store goods left.
 */
export async function createStoreTransfer(
  ctx: OrgContext,
  input: StoreTransferInput,
  options: TransferTicketOptions = {},
) {
  const meta = await requestMeta()
  const ticketOrigin = options.ticketOrigin ?? 'AUTO'

  return db.$transaction(async (tx) => {
    if (input.fromStoreId === input.toStoreId) {
      throw validation('Choose a different store to send the stock to.', {
        toStoreId: ['Choose a different store to send the stock to.'],
      })
    }

    const [fromStore, toStore, item, shelf] = await Promise.all([
      tx.store.findFirst({
        where: { id: input.fromStoreId, orgId: ctx.orgId, isActive: true },
        select: { id: true, name: true, inventoryAccountId: true },
      }),
      tx.store.findFirst({
        where: { id: input.toStoreId, orgId: ctx.orgId, isActive: true },
        select: { id: true, name: true, inventoryAccountId: true },
      }),
      tx.item.findFirst({
        where: { id: input.itemId, orgId: ctx.orgId, deletedAt: null },
        select: { id: true, name: true, type: true },
      }),
      storeService.quantities(ctx),
    ])

    if (!fromStore) throw notFound('From store')
    if (!toStore) throw notFound('To store')
    if (!item) throw notFound('Item')
    if (item.type !== 'INVENTORY') {
      throw precondition(`"${item.name}" is not a tracked item, so it has no stock to move.`)
    }

    const available = new Decimal(shelf.byItem[item.id]?.[fromStore.id] ?? '0')
    const quantity = new Decimal(input.quantity)
    if (quantity.greaterThan(available)) {
      throw precondition(
        `${fromStore.name} holds ${available.toFixed(2)} of "${item.name}", and this needs ${quantity.toFixed(2)}.`,
      )
    }

    const number = await assignDocumentNumber(tx, ctx.orgId, 'STORE_TRANSFER', input.number)
    const clash = await tx.storeTransfer.findFirst({
      where: { orgId: ctx.orgId, number },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    const transfer = await tx.storeTransfer.create({
      data: {
        orgId: ctx.orgId,
        number,
        date: toDate(input.date),
        fromStoreId: fromStore.id,
        toStoreId: toStore.id,
        itemId: item.id,
        quantity: quantity.toFixed(4),
        unitCost: '0',
        value: '0',
        memo: input.memo ?? null,
        createdById: ctx.userId,
      },
      select: { id: true, number: true },
    })

    const out = await recordMovement(tx, ctx, {
      itemId: item.id,
      date: input.date,
      type: 'TRANSFER',
      sourceType: 'TRANSFER',
      sourceId: transfer.id,
      quantity: quantity.negated(),
      storeId: fromStore.id,
    })

    await recordMovement(tx, ctx, {
      itemId: item.id,
      date: input.date,
      type: 'TRANSFER',
      sourceType: 'TRANSFER',
      sourceId: transfer.id,
      quantity,
      unitCost: out.unitCost,
      storeId: toStore.id,
    })

    const value = out.value.abs()
    await tx.storeTransfer.update({
      where: { id: transfer.id },
      data: {
        unitCost: out.unitCost.toFixed(6),
        value: value.toFixed(4),
      },
    })

    if (
      !value.isZero() &&
      fromStore.inventoryAccountId !== toStore.inventoryAccountId
    ) {
      const journal = await postJournal(tx, ctx, {
        date: input.date,
        memo: `Store transfer ${transfer.number}: ${item.name} · ${fromStore.name} → ${toStore.name}`,
        sourceType: 'TRANSFER',
        sourceId: transfer.id,
        lines: [
          {
            accountId: toStore.inventoryAccountId,
            debit: value,
            description: `From ${fromStore.name}`,
          },
          {
            accountId: fromStore.inventoryAccountId,
            credit: value,
            description: `To ${toStore.name}`,
          },
        ],
      })

      await tx.storeTransfer.update({
        where: { id: transfer.id },
        data: { journalId: journal.id },
      })
      await tx.inventoryTransaction.updateMany({
        where: { orgId: ctx.orgId, sourceId: transfer.id, journalId: null },
        data: { journalId: journal.id },
      })
    }

    const ticketNumber = await assignDocumentNumber(
      tx,
      ctx.orgId,
      'STORE_TICKET',
      options.ticketNumber,
    )
    const ticketClash = await tx.storeTicket.findFirst({
      where: { orgId: ctx.orgId, number: ticketNumber },
      select: { id: true },
    })
    if (ticketClash) throw numberTaken()

    const ticket = await tx.storeTicket.create({
      data: {
        orgId: ctx.orgId,
        number: ticketNumber,
        date: toDate(input.date),
        storeId: fromStore.id,
        toStoreId: toStore.id,
        itemId: item.id,
        quantity: quantity.toFixed(4),
        unitCost: out.unitCost.toFixed(6),
        value: value.toFixed(4),
        takenBy: options.takenBy?.trim() || null,
        memo: input.memo ?? null,
        origin: ticketOrigin,
        transferId: transfer.id,
        createdById: ctx.userId,
      },
      select: { id: true, number: true },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'StoreTransfer',
        entityId: transfer.id,
        action: 'CREATE',
        after: {
          number: transfer.number,
          ticketNumber: ticket.number,
          itemId: item.id,
          fromStoreId: fromStore.id,
          toStoreId: toStore.id,
          quantity: quantity.toString(),
          value: value.toString(),
        },
      },
      meta,
    )

    return {
      id: transfer.id,
      number: transfer.number,
      ticketId: ticket.id,
      ticketNumber: ticket.number,
    }
  })
}

/** Manual store ticket — takes stock from one store to another and numbers the ticket. */
export async function createStoreTicket(ctx: OrgContext, input: StoreTicketInput) {
  return createStoreTransfer(
    ctx,
    {
      number: '',
      date: input.date,
      fromStoreId: input.storeId,
      toStoreId: input.toStoreId,
      itemId: input.itemId,
      quantity: input.quantity,
      memo: input.memo,
    },
    {
      ticketOrigin: 'MANUAL',
      ticketNumber: input.number,
      takenBy: input.takenBy,
    },
  ).then((result) => ({
    id: result.ticketId,
    number: result.ticketNumber,
    transferId: result.id,
    transferNumber: result.number,
  }))
}

/** Recent tickets that left this store — for the store dashboard. */
export async function ticketsForStore(ctx: OrgContext, storeId: string, limit = 20) {
  return db.storeTicket.findMany({
    where: { orgId: ctx.orgId, storeId, status: 'POSTED' },
    select: {
      id: true,
      number: true,
      date: true,
      quantity: true,
      unitCost: true,
      value: true,
      takenBy: true,
      origin: true,
      memo: true,
      item: { select: { id: true, name: true, sku: true } },
      toStore: { select: { id: true, name: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  })
}

export { toCalendarDate, type CalendarDate }
