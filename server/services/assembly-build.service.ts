import 'server-only'

import { toDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import type { AssemblyBuildInput } from '@/lib/validation/inventory'
import { CLEAR_DELETION, restoreSoftDeletedDocument, softDeleteDocument } from '@/server/accounting/deletion'
import {
  positionsOf,
  recordMovement,
  restoreMovementsFor,
  reverseMovementsFor,
} from '@/server/accounting/inventory'
import { postJournal, type DraftLine } from '@/server/accounting/posting'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import { assignDocumentNumber, numberTaken } from '@/server/sequences'
import * as storeService from '@/server/services/store.service'

const STOCKED = new Set(['INVENTORY', 'INVENTORY_ASSEMBLY'])

/**
 * Produce finished Inventory Assembly units from the bill of materials.
 *
 * Components leave at average cost; the assembly arrives at materials cost so a
 * later sale posts the right COGS. The journal only moves value between inventory
 * accounts (no P&L) when those accounts differ.
 */
export async function create(ctx: OrgContext, input: AssemblyBuildInput) {
  const meta = await requestMeta()
  return db.$transaction((tx) => createInTx(tx, ctx, input, meta))
}

/** Testable core — runs inside the caller's transaction. */
export async function createInTx(
  tx: Tx,
  ctx: OrgContext,
  input: AssemblyBuildInput,
  meta?: Awaited<ReturnType<typeof requestMeta>>,
) {
  const audit = meta ?? (await requestMeta())
  const buildQty = new Decimal(input.quantity)

  const assembly = await tx.item.findFirst({
    where: { id: input.itemId, orgId: ctx.orgId, deletedAt: null },
    select: {
      id: true,
      name: true,
      type: true,
      isActive: true,
      inventoryAccountId: true,
      bomParents: {
        orderBy: { sortOrder: 'asc' },
        select: {
          quantity: true,
          component: {
            select: {
              id: true,
              name: true,
              type: true,
              isActive: true,
              inventoryAccountId: true,
            },
          },
        },
      },
    },
  })
  if (!assembly) throw notFound('Item')
  if (assembly.type !== 'INVENTORY_ASSEMBLY') {
    throw validation(`"${assembly.name}" is not an inventory assembly.`, {
      itemId: ['Choose an inventory assembly'],
    })
  }
  if (!assembly.isActive) {
    throw precondition(`"${assembly.name}" is archived and cannot be built.`)
  }
  if (!assembly.inventoryAccountId) {
    throw precondition(`"${assembly.name}" has no inventory account.`)
  }

  const bom = assembly.bomParents.filter((row) => row.component.isActive)
  if (bom.length === 0) {
    throw validation(
      `"${assembly.name}" has no bill of materials. Add inventory parts on the item first.`,
      { itemId: ['Add components to the assembly'] },
    )
  }

  for (const row of bom) {
    const child = row.component
    if (!STOCKED.has(child.type)) {
      throw validation(
        `"${child.name}" cannot be used in a build — only inventory parts and assemblies.`,
      )
    }
    if (!child.inventoryAccountId) {
      throw precondition(`"${child.name}" has no inventory account.`)
    }
    if (child.id === assembly.id) {
      throw validation(`"${assembly.name}" cannot include itself in its bill of materials.`)
    }
  }

  let storeId = input.storeId ?? null
  if (storeId) {
    const store = await tx.store.findFirst({
      where: { id: storeId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!store) throw notFound('Store')
  }

  const componentIds = bom.map((row) => row.component.id)
  const positions = await positionsOf(tx, ctx.orgId, componentIds)
  const shelf = storeId ? await storeService.quantities(ctx) : null

  const planned = bom.map((row) => {
    const bomQty = new Decimal(row.quantity.toString())
    const needed = bomQty.times(buildQty)
    const position = positions.get(row.component.id)!
    const onHand = storeId
      ? new Decimal(shelf?.byItem[row.component.id]?.[storeId] ?? '0')
      : position.quantity
    return {
      component: row.component,
      bomQty,
      needed,
      onHand,
      averageCost: position.averageCost,
    }
  })

  if (!ctx.organization.allowNegativeStock) {
    for (const line of planned) {
      if (line.needed.greaterThan(line.onHand)) {
        throw precondition(
          `There ${line.onHand.equals(1) ? 'is' : 'are'} ${line.onHand.toFixed(2)} of "${line.component.name}" in stock ` +
            `and this build needs ${line.needed.toFixed(2)}. Receive stock first, or allow negative stock in settings.`,
        )
      }
    }
  }

  const number = await assignDocumentNumber(tx, ctx.orgId, 'ASSEMBLY_BUILD', input.number)
  const clash = await tx.assemblyBuild.findFirst({
    where: { orgId: ctx.orgId, number },
    select: { id: true },
  })
  if (clash) throw numberTaken()

  const build = await tx.assemblyBuild.create({
    data: {
      orgId: ctx.orgId,
      number,
      date: toDate(input.date),
      itemId: assembly.id,
      storeId,
      quantity: buildQty.toFixed(4),
      unitCost: '0',
      value: '0',
      memo: input.memo ?? null,
      createdById: ctx.userId,
    },
    select: { id: true, number: true },
  })

  const storeAccounts = await storeService.accountsFor(tx, ctx.orgId, [storeId])
  const inventoryAccountFor = (itemInventoryAccountId: string) =>
    (storeId && storeAccounts.get(storeId)) || itemInventoryAccountId

  const accountDeltas = new Map<string, Decimal>()
  let materialsValue = ZERO
  let lineNumber = 0

  for (const line of planned) {
    const movement = await recordMovement(tx, ctx, {
      itemId: line.component.id,
      date: input.date,
      type: 'BUILD',
      sourceType: 'ASSEMBLY_BUILD',
      sourceId: build.id,
      quantity: line.needed.negated(),
      storeId,
    })

    const absValue = movement.value.abs()
    materialsValue = materialsValue.plus(absValue)

    await tx.assemblyBuildLine.create({
      data: {
        orgId: ctx.orgId,
        buildId: build.id,
        lineNumber: ++lineNumber,
        itemId: line.component.id,
        quantity: line.needed.toFixed(4),
        unitCost: movement.unitCost.toFixed(6),
        value: absValue.toFixed(4),
      },
    })

    const accountId = inventoryAccountFor(line.component.inventoryAccountId!)
    accountDeltas.set(accountId, (accountDeltas.get(accountId) ?? ZERO).minus(absValue))
  }

  if (materialsValue.isZero()) {
    throw validation(
      'This build has no materials cost. Receive the component items first so they have an average cost.',
    )
  }

  // Value override keeps finished goods exactly equal to materials (no cent drift).
  const finished = await recordMovement(tx, ctx, {
    itemId: assembly.id,
    date: input.date,
    type: 'BUILD',
    sourceType: 'ASSEMBLY_BUILD',
    sourceId: build.id,
    quantity: buildQty,
    valueOverride: materialsValue,
    storeId,
  })
  const unitCost = buildQty.isZero()
    ? ZERO
    : materialsValue.dividedBy(buildQty).toDecimalPlaces(6, Decimal.ROUND_HALF_UP)

  const assemblyAccountId = inventoryAccountFor(assembly.inventoryAccountId)
  accountDeltas.set(
    assemblyAccountId,
    (accountDeltas.get(assemblyAccountId) ?? ZERO).plus(finished.value.abs()),
  )

  await tx.assemblyBuild.update({
    where: { id: build.id },
    data: {
      unitCost: unitCost.toFixed(6),
      value: materialsValue.toFixed(4),
    },
  })

  const journalLines: DraftLine[] = []
  for (const [accountId, delta] of accountDeltas) {
    if (delta.isZero()) continue
    journalLines.push(
      delta.isPositive()
        ? {
            accountId,
            debit: delta,
            description: `Build ${build.number} · ${assembly.name}`,
          }
        : {
            accountId,
            credit: delta.abs(),
            description: `Build ${build.number} · materials`,
          },
    )
  }

  if (journalLines.length >= 2) {
    const journal = await postJournal(tx, ctx, {
      date: input.date,
      memo: `Assembly build ${build.number} · ${assembly.name}${input.memo ? ` — ${input.memo}` : ''}`,
      sourceType: 'ASSEMBLY_BUILD',
      sourceId: build.id,
      lines: journalLines,
    })
    await tx.assemblyBuild.update({
      where: { id: build.id },
      data: { journalId: journal.id },
    })
    await tx.inventoryTransaction.updateMany({
      where: { orgId: ctx.orgId, sourceId: build.id, journalId: null },
      data: { journalId: journal.id },
    })
  }

  await writeAudit(
    tx,
    ctx,
    {
      entity: 'AssemblyBuild',
      entityId: build.id,
      action: 'CREATE',
      after: {
        number: build.number,
        itemId: assembly.id,
        quantity: buildQty.toString(),
        unitCost: unitCost.toString(),
        value: materialsValue.toString(),
      },
    },
    audit,
  )

  return {
    id: build.id,
    number: build.number,
    quantity: buildQty.toString(),
    unitCost: unitCost.toString(),
    value: materialsValue.toString(),
  }
}

export async function remove(ctx: OrgContext, id: string, reason?: string | null) {
  return db.$transaction(async (tx) => {
    const build = await tx.assemblyBuild.findFirst({
      where: { id, orgId: ctx.orgId, deletedAt: undefined },
      select: { id: true, number: true, status: true, journalId: true, deletedAt: true },
    })
    if (!build) throw notFound('Assembly build')
    if (build.deletedAt) return { id, number: build.number }

    await reverseMovementsFor(tx, ctx, { sourceId: id })

    return softDeleteDocument(tx, ctx, {
      mark: (stamp) => tx.assemblyBuild.update({ where: { id }, data: stamp }),
      entity: 'AssemblyBuild',
      id,
      number: build.number,
      journalIds: [build.journalId],
      reason,
      before: { status: build.status },
    })
  })
}

/** Put a deleted assembly build back into the books and the stock ledger. */
export async function restore(ctx: OrgContext, id: string) {
  return db.$transaction(async (tx) => {
    const build = await tx.assemblyBuild.findFirst({
      where: { id, orgId: ctx.orgId, deletedAt: undefined },
      select: { id: true, number: true, journalId: true, deletedAt: true },
    })
    if (!build) throw notFound('Assembly build')
    const href = '/inventory/stock'
    if (!build.deletedAt) return { id, number: build.number, href }

    if (build.journalId) {
      await restoreMovementsFor(tx, ctx, { sourceId: id, journalId: build.journalId })
    }

    await restoreSoftDeletedDocument(tx, ctx, {
      clear: () => tx.assemblyBuild.update({ where: { id }, data: CLEAR_DELETION }),
      entity: 'AssemblyBuild',
      id,
      number: build.number,
      journalIds: [build.journalId],
    })

    return { id, number: build.number, href }
  })
}

/** Assemblies with a BOM, for the build form picker. */
export async function listAssemblies(ctx: OrgContext) {
  const rows = await db.item.findMany({
    where: {
      orgId: ctx.orgId,
      deletedAt: null,
      isActive: true,
      type: 'INVENTORY_ASSEMBLY',
      bomParents: { some: {} },
    },
    select: {
      id: true,
      name: true,
      sku: true,
      inventoryAccountId: true,
      bomParents: {
        orderBy: { sortOrder: 'asc' },
        select: {
          quantity: true,
          component: {
            select: {
              id: true,
              name: true,
              sku: true,
              type: true,
              isActive: true,
              inventoryAccountId: true,
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const componentIds = [
    ...new Set(
      rows.flatMap((row) =>
        row.bomParents.filter((b) => b.component.isActive).map((b) => b.component.id),
      ),
    ),
  ]
  const positions = await positionsOf(db as unknown as Tx, ctx.orgId, componentIds)
  const assemblyPositions = await positionsOf(
    db as unknown as Tx,
    ctx.orgId,
    rows.map((row) => row.id),
  )
  const shelf = await storeService.quantities(ctx)

  return rows.map((row) => {
    const components = row.bomParents
      .filter((b) => b.component.isActive && STOCKED.has(b.component.type))
      .map((b) => {
        const position = positions.get(b.component.id)
        return {
          id: b.component.id,
          label: b.component.sku ? `${b.component.name} (${b.component.sku})` : b.component.name,
          quantity: b.quantity.toString(),
          onHand: (position?.quantity ?? ZERO).toFixed(4),
          averageCost: (position?.averageCost ?? ZERO).toFixed(6),
          byStore: shelf.byItem[b.component.id] ?? {},
        }
      })
    const estimated = components.reduce((sum, component) => {
      return sum.plus(new Decimal(component.averageCost).times(component.quantity))
    }, ZERO)
    const assemblyPos = assemblyPositions.get(row.id)
    return {
      id: row.id,
      label: row.sku ? `${row.name} (${row.sku})` : row.name,
      onHand: (assemblyPos?.quantity ?? ZERO).toFixed(4),
      averageCost: (assemblyPos?.averageCost ?? ZERO).toFixed(6),
      estimatedCost: estimated.toFixed(6),
      components,
    }
  })
}
