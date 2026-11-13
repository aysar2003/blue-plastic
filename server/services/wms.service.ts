import 'server-only'

import { today } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import {
  canCancelPutaway,
  canCancelWave,
  canCompletePutaway,
  canReleaseWave,
  nextBinRunning,
  refuseShortBin,
  waveNumberFromSeq,
  type PutawayStatus,
  type WaveStatus,
} from '@/lib/erp/wms-bin'
import {
  binCodeValid,
  canCancelPick,
  canCompletePick,
  canStartPick,
  type PickStatus,
} from '@/lib/erp/wms-pick'
import { positionOf, recordMovement } from '@/server/accounting/inventory'
import { postJournal, type DraftLine } from '@/server/accounting/posting'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import * as storeService from '@/server/services/store.service'

async function binOnHand(tx: Tx, orgId: string, binId: string, itemId: string): Promise<Decimal> {
  const last = await tx.binMovement.findFirst({
    where: { orgId, binId, itemId },
    orderBy: { createdAt: 'desc' },
    select: { runningQuantity: true },
  })
  return last ? new Decimal(last.runningQuantity.toString()) : ZERO
}

async function recordBinMovement(
  tx: Tx,
  ctx: OrgContext,
  input: {
    binId: string
    itemId: string
    quantity: Decimal
    sourceType: string
    sourceId: string
  },
) {
  const prior = await binOnHand(tx, ctx.orgId, input.binId, input.itemId)
  const running = nextBinRunning(prior, input.quantity)
  if (!ctx.organization.allowNegativeStock && running.lessThan(ZERO)) {
    throw precondition(
      `Bin would go short (${prior.toFixed(2)} on hand, move ${input.quantity.toFixed(2)}).`,
    )
  }
  return tx.binMovement.create({
    data: {
      orgId: ctx.orgId,
      binId: input.binId,
      itemId: input.itemId,
      quantity: input.quantity.toFixed(4),
      runningQuantity: running.toFixed(4),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    },
    select: { id: true, runningQuantity: true },
  })
}

export async function listBoard(ctx: OrgContext) {
  const [stores, bins, picks, items, openOrders, putaways, waves] = await Promise.all([
    db.store.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.stockBin.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { code: 'asc' },
      include: { store: { select: { name: true } } },
      take: 80,
    }),
    db.pickTask.findMany({
      where: { orgId: ctx.orgId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        item: { select: { name: true, trackLots: true, trackSerials: true } },
        store: { select: { name: true } },
        bin: { select: { code: true } },
        wave: { select: { number: true, status: true } },
      },
      take: 80,
    }),
    db.item.findMany({
      where: {
        orgId: ctx.orgId,
        isActive: true,
        deletedAt: null,
        type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
      },
      select: { id: true, name: true, trackLots: true, trackSerials: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
    db.salesDocument.findMany({
      where: {
        orgId: ctx.orgId,
        type: 'SALES_ORDER',
        status: { in: ['OPEN', 'PARTIAL'] },
        deletedAt: null,
      },
      select: { id: true, number: true },
      orderBy: { date: 'desc' },
      take: 40,
    }),
    db.putawayTask.findMany({
      where: { orgId: ctx.orgId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        item: { select: { name: true } },
        store: { select: { name: true } },
        bin: { select: { code: true } },
      },
      take: 40,
    }),
    db.pickWave.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { picks: true } } },
      take: 20,
    }),
  ])

  const binBalances = await db.$queryRaw<
    { binId: string; itemId: string; qty: string; itemName: string; binCode: string }[]
  >`
    SELECT DISTINCT ON (m."binId", m."itemId")
           m."binId" AS "binId",
           m."itemId" AS "itemId",
           m."runningQuantity"::text AS qty,
           i.name AS "itemName",
           b.code AS "binCode"
      FROM bin_movements m
      JOIN items i ON i.id = m."itemId"
      JOIN stock_bins b ON b.id = m."binId"
     WHERE m."orgId" = ${ctx.orgId}
     ORDER BY m."binId", m."itemId", m."createdAt" DESC
  `

  return {
    stores,
    bins,
    picks: picks.map((row) => ({ ...row, qty: row.qty.toString() })),
    items,
    openOrders,
    putaways: putaways.map((row) => ({ ...row, qty: row.qty.toString() })),
    waves,
    binBalances,
  }
}

export async function createBin(
  ctx: OrgContext,
  input: { storeId: string; code: string; name: string },
) {
  const code = input.code.trim().toUpperCase()
  if (!binCodeValid(code)) throw validation('Bin code: letters, numbers, dot or dash.')
  const store = await db.store.findFirst({
    where: { id: input.storeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!store) throw notFound('Store')
  const name = input.name.trim() || code
  return db.stockBin.create({
    data: { orgId: ctx.orgId, storeId: store.id, code, name },
    select: { id: true },
  })
}

export async function createPick(
  ctx: OrgContext,
  input: {
    storeId: string
    itemId: string
    qty: string
    binId?: string | null
    sourceType?: string | null
    sourceId?: string | null
    lotNumber?: string | null
    serialNumber?: string | null
    waveId?: string | null
  },
) {
  const qty = new Decimal(input.qty)
  if (qty.lessThanOrEqualTo(0)) throw validation('Quantity must be greater than zero.')
  const store = await db.store.findFirst({
    where: { id: input.storeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!store) throw notFound('Store')
  const item = await db.item.findFirst({
    where: { id: input.itemId, orgId: ctx.orgId, deletedAt: null },
    select: { id: true, trackLots: true, trackSerials: true },
  })
  if (!item) throw notFound('Item')

  let binId: string | null = null
  if (input.binId) {
    const bin = await db.stockBin.findFirst({
      where: { id: input.binId, orgId: ctx.orgId, storeId: store.id },
      select: { id: true },
    })
    if (!bin) throw notFound('Bin')
    binId = bin.id
  }

  const sourceType = input.sourceType?.trim() || null
  const sourceId = input.sourceId?.trim() || null
  if (sourceType || sourceId) {
    if (sourceType !== 'SALES_ORDER' && sourceType !== 'DELIVERY_NOTE') {
      throw validation('Pick source must be a sales order or delivery note.')
    }
    if (!sourceId) throw validation('Choose the sales order or delivery for this pick.')
    if (sourceType === 'SALES_ORDER') {
      const so = await db.salesDocument.findFirst({
        where: { id: sourceId, orgId: ctx.orgId, type: 'SALES_ORDER', deletedAt: null },
        select: { id: true },
      })
      if (!so) throw notFound('Sales order')
    } else {
      const note = await db.deliveryNote.findFirst({
        where: { id: sourceId, orgId: ctx.orgId },
        select: { id: true },
      })
      if (!note) throw notFound('Delivery note')
    }
  }

  let waveId: string | null = null
  if (input.waveId) {
    const wave = await db.pickWave.findFirst({
      where: { id: input.waveId, orgId: ctx.orgId, status: { in: ['OPEN', 'RELEASED'] } },
      select: { id: true },
    })
    if (!wave) throw notFound('Wave')
    waveId = wave.id
  }

  const lotNumber = input.lotNumber?.trim() || null
  const serialNumber = input.serialNumber?.trim() || null
  if (item.trackLots && !lotNumber) {
    throw validation('This item tracks lots — enter a lot number.')
  }
  if (item.trackSerials && !serialNumber) {
    throw validation('This item tracks serials — enter a serial number.')
  }

  return db.pickTask.create({
    data: {
      orgId: ctx.orgId,
      storeId: store.id,
      itemId: item.id,
      binId,
      waveId,
      qty: qty.toFixed(4),
      sourceType,
      sourceId,
      lotNumber,
      serialNumber,
    },
    select: { id: true },
  })
}

export async function createPickFromSalesOrder(
  ctx: OrgContext,
  input: { salesOrderId: string; lineId: string; storeId: string; binId?: string | null },
) {
  const line = await db.salesDocumentLine.findFirst({
    where: {
      id: input.lineId,
      orgId: ctx.orgId,
      documentId: input.salesOrderId,
      document: { type: 'SALES_ORDER', deletedAt: null },
    },
    select: {
      id: true,
      itemId: true,
      quantity: true,
      lotNumber: true,
      serialNumber: true,
      item: { select: { type: true } },
    },
  })
  if (!line?.itemId) throw notFound('Sales order line')
  if (line.item?.type !== 'INVENTORY' && line.item?.type !== 'INVENTORY_ASSEMBLY') {
    throw validation('Only stocked items can be picked.')
  }
  return createPick(ctx, {
    storeId: input.storeId,
    itemId: line.itemId,
    qty: line.quantity.toString(),
    binId: input.binId,
    sourceType: 'SALES_ORDER',
    sourceId: input.salesOrderId,
    lotNumber: line.lotNumber,
    serialNumber: line.serialNumber,
  })
}

export async function createPutaway(
  ctx: OrgContext,
  input: {
    storeId: string
    itemId: string
    qty: string
    binId?: string | null
    sourceType?: string | null
    sourceId?: string | null
  },
) {
  const qty = new Decimal(input.qty)
  if (qty.lessThanOrEqualTo(0)) throw validation('Quantity must be greater than zero.')
  const store = await db.store.findFirst({
    where: { id: input.storeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!store) throw notFound('Store')
  const item = await db.item.findFirst({
    where: { id: input.itemId, orgId: ctx.orgId, deletedAt: null },
    select: { id: true },
  })
  if (!item) throw notFound('Item')
  let binId: string | null = null
  if (input.binId) {
    const bin = await db.stockBin.findFirst({
      where: { id: input.binId, orgId: ctx.orgId, storeId: store.id },
      select: { id: true },
    })
    if (!bin) throw notFound('Bin')
    binId = bin.id
  }
  return db.putawayTask.create({
    data: {
      orgId: ctx.orgId,
      storeId: store.id,
      itemId: item.id,
      binId,
      qty: qty.toFixed(4),
      sourceType: input.sourceType?.trim() || null,
      sourceId: input.sourceId?.trim() || null,
    },
    select: { id: true },
  })
}

export async function completePutaway(ctx: OrgContext, id: string, binId?: string | null) {
  return db.$transaction((tx) => completePutawayInTx(tx, ctx, id, binId))
}

export async function completePutawayInTx(
  tx: Tx,
  ctx: OrgContext,
  id: string,
  binId?: string | null,
) {
  const row = await tx.putawayTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true,
      status: true,
      qty: true,
      storeId: true,
      itemId: true,
      binId: true,
      item: { select: { name: true } },
    },
  })
  if (!row) throw notFound('Putaway')
  if (!canCompletePutaway(row.status as PutawayStatus)) {
    throw precondition('This putaway cannot complete.')
  }
  const targetBinId = binId || row.binId
  if (!targetBinId) throw validation('Choose a bin for putaway.')
  const bin = await tx.stockBin.findFirst({
    where: { id: targetBinId, orgId: ctx.orgId, storeId: row.storeId },
    select: { id: true },
  })
  if (!bin) throw notFound('Bin')

  const qty = new Decimal(row.qty.toString())
  await recordBinMovement(tx, ctx, {
    binId: bin.id,
    itemId: row.itemId,
    quantity: qty,
    sourceType: 'PUTAWAY',
    sourceId: row.id,
  })

  return tx.putawayTask.update({
    where: { id: row.id },
    data: { status: 'DONE', binId: bin.id },
    select: { id: true },
  })
}

export async function cancelPutaway(ctx: OrgContext, id: string) {
  const row = await db.putawayTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Putaway')
  if (!canCancelPutaway(row.status as PutawayStatus)) {
    throw precondition('This putaway cannot cancel.')
  }
  return db.putawayTask.update({
    where: { id: row.id },
    data: { status: 'CANCELLED' },
    select: { id: true },
  })
}

export async function createWave(ctx: OrgContext, notes?: string | null) {
  const count = await db.pickWave.count({ where: { orgId: ctx.orgId } })
  return db.pickWave.create({
    data: {
      orgId: ctx.orgId,
      number: waveNumberFromSeq(count + 1),
      notes: notes?.trim() || null,
    },
    select: { id: true, number: true },
  })
}

export async function releaseWave(ctx: OrgContext, id: string) {
  const wave = await db.pickWave.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true, _count: { select: { picks: true } } },
  })
  if (!wave) throw notFound('Wave')
  if (!canReleaseWave(wave.status as WaveStatus)) throw precondition('This wave cannot release.')
  if (wave._count.picks === 0) throw precondition('Add picks to the wave first.')
  return db.pickWave.update({
    where: { id: wave.id },
    data: { status: 'RELEASED' },
    select: { id: true },
  })
}

export async function cancelWave(ctx: OrgContext, id: string) {
  const wave = await db.pickWave.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!wave) throw notFound('Wave')
  if (!canCancelWave(wave.status as WaveStatus)) throw precondition('This wave cannot cancel.')
  await db.pickTask.updateMany({
    where: { orgId: ctx.orgId, waveId: wave.id, status: { in: ['OPEN', 'PICKING'] } },
    data: { status: 'CANCELLED' },
  })
  return db.pickWave.update({
    where: { id: wave.id },
    data: { status: 'CANCELLED' },
    select: { id: true },
  })
}

/** Complete every open/picking task on a released wave. */
export async function completeWave(ctx: OrgContext, id: string) {
  return db.$transaction(async (tx) => {
    const wave = await tx.pickWave.findFirst({
      where: { id, orgId: ctx.orgId },
      select: { id: true, status: true },
    })
    if (!wave) throw notFound('Wave')
    if (wave.status !== 'RELEASED') throw precondition('Release the wave before completing it.')
    const picks = await tx.pickTask.findMany({
      where: { orgId: ctx.orgId, waveId: wave.id, status: { in: ['OPEN', 'PICKING'] } },
      select: { id: true },
    })
    for (const pick of picks) {
      await completePickInTx(tx, ctx, pick.id)
    }
    return tx.pickWave.update({
      where: { id: wave.id },
      data: { status: 'DONE' },
      select: { id: true },
    })
  })
}

export async function startPick(ctx: OrgContext, id: string) {
  const row = await db.pickTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Pick')
  if (!canStartPick(row.status as PickStatus)) throw precondition('This pick cannot start.')
  return db.pickTask.update({
    where: { id: row.id },
    data: { status: 'PICKING' },
    select: { id: true },
  })
}

export async function completePick(ctx: OrgContext, id: string) {
  return db.$transaction((tx) => completePickInTx(tx, ctx, id))
}

/** Testable core — runs inside the caller's transaction. */
export async function completePickInTx(tx: Tx, ctx: OrgContext, id: string) {
  const row = await tx.pickTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true,
      status: true,
      qty: true,
      storeId: true,
      itemId: true,
      binId: true,
      lotNumber: true,
      serialNumber: true,
      item: {
        select: {
          id: true,
          name: true,
          inventoryAccountId: true,
          cogsAccountId: true,
        },
      },
    },
  })
  if (!row) throw notFound('Pick')
  if (!canCompletePick(row.status as PickStatus)) throw precondition('This pick cannot complete.')

  const qty = new Decimal(row.qty.toString())
  const position = await positionOf(tx, row.itemId)
  if (!ctx.organization.allowNegativeStock && qty.greaterThan(position.quantity)) {
    throw precondition(
      `Only ${position.quantity.toFixed(2)} of "${row.item.name}" on hand; pick needs ${qty.toFixed(2)}.`,
    )
  }

  if (row.binId) {
    const onBin = await binOnHand(tx, ctx.orgId, row.binId, row.itemId)
    if (!ctx.organization.allowNegativeStock && refuseShortBin(onBin, qty)) {
      throw precondition(
        `Only ${onBin.toFixed(2)} of "${row.item.name}" in this bin; pick needs ${qty.toFixed(2)}.`,
      )
    }
  }

  if (!row.item.inventoryAccountId || !row.item.cogsAccountId) {
    throw precondition(`"${row.item.name}" needs inventory and COGS accounts to pick.`)
  }

  const date = today(ctx.organization.timeZone)
  const storeAccounts = await storeService.accountsFor(tx, ctx.orgId, [row.storeId])
  const inventoryAccountId = storeAccounts.get(row.storeId) || row.item.inventoryAccountId

  const movement = await recordMovement(tx, ctx, {
    itemId: row.itemId,
    date,
    type: 'ADJUSTMENT',
    sourceType: 'INVENTORY_ADJUSTMENT',
    sourceId: row.id,
    quantity: qty.negated(),
    storeId: row.storeId,
    lotNumber: row.lotNumber,
    serialNumber: row.serialNumber,
  })

  if (row.binId) {
    await recordBinMovement(tx, ctx, {
      binId: row.binId,
      itemId: row.itemId,
      quantity: qty.negated(),
      sourceType: 'PICK',
      sourceId: row.id,
    })
  }

  const absValue = movement.value.abs()
  if (absValue.greaterThan(ZERO)) {
    const lines: DraftLine[] = [
      {
        accountId: row.item.cogsAccountId,
        debit: absValue,
        description: `Pick · ${row.item.name}`,
      },
      {
        accountId: inventoryAccountId,
        credit: absValue,
        description: `Pick · ${row.item.name}`,
      },
    ]
    const journal = await postJournal(tx, ctx, {
      date,
      memo: `Warehouse pick · ${row.item.name}`,
      sourceType: 'INVENTORY_ADJUSTMENT',
      sourceId: row.id,
      lines,
    })
    await tx.inventoryTransaction.updateMany({
      where: { orgId: ctx.orgId, sourceId: row.id, journalId: null },
      data: { journalId: journal.id },
    })
  }

  return tx.pickTask.update({
    where: { id: row.id },
    data: { status: 'PICKED' },
    select: { id: true },
  })
}

export async function cancelPick(ctx: OrgContext, id: string) {
  const row = await db.pickTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Pick')
  if (!canCancelPick(row.status as PickStatus)) throw precondition('This pick cannot cancel.')
  return db.pickTask.update({
    where: { id: row.id },
    data: { status: 'CANCELLED' },
    select: { id: true },
  })
}

export async function countOpenWaves(ctx: OrgContext): Promise<number> {
  return db.pickWave.count({
    where: { orgId: ctx.orgId, status: { in: ['OPEN', 'RELEASED'] } },
  })
}
