import 'server-only'

import { toDate, today } from '@/lib/date'
import { Decimal } from '@/lib/money'
import {
  canCancelWorkOrder,
  canCompleteWorkOrder,
  canReleaseWorkOrder,
  type WorkOrderStatus,
} from '@/lib/erp/work-order'
import type { WorkOrderInput } from '@/lib/validation/work-order'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import { assignDocumentNumber, numberTaken } from '@/server/sequences'
import * as assemblyBuildService from '@/server/services/assembly-build.service'

const STOCKED = new Set(['INVENTORY', 'INVENTORY_ASSEMBLY'])

export async function list(ctx: OrgContext) {
  const rows = await db.workOrder.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ status: 'asc' }, { date: 'desc' }],
    include: {
      item: { select: { name: true } },
      store: { select: { name: true } },
      build: { select: { id: true, number: true } },
    },
    take: 100,
  })
  return rows.map((row) => ({
    ...row,
    quantity: row.quantity.toString(),
  }))
}

export async function get(ctx: OrgContext, id: string) {
  const row = await db.workOrder.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      item: { select: { id: true, name: true } },
      store: { select: { id: true, name: true } },
      build: { select: { id: true, number: true } },
      lines: {
        orderBy: { lineNumber: 'asc' },
        include: { item: { select: { id: true, name: true } } },
      },
    },
  })
  if (!row) throw notFound('Work order')
  return {
    ...row,
    quantity: row.quantity.toString(),
    lines: row.lines.map((line) => ({
      ...line,
      quantity: line.quantity.toString(),
    })),
  }
}

async function snapBomLines(
  tx: Tx,
  ctx: OrgContext,
  workOrderId: string,
  assemblyId: string,
  buildQty: Decimal,
) {
  const assembly = await tx.item.findFirst({
    where: { id: assemblyId, orgId: ctx.orgId, deletedAt: null },
    select: {
      id: true,
      name: true,
      type: true,
      bomParents: {
        orderBy: { sortOrder: 'asc' },
        select: {
          quantity: true,
          component: {
            select: { id: true, name: true, type: true, isActive: true },
          },
        },
      },
    },
  })
  if (!assembly) throw notFound('Item')
  if (assembly.type !== 'INVENTORY_ASSEMBLY') {
    throw validation(`"${assembly.name}" is not an inventory assembly.`)
  }
  const bom = assembly.bomParents.filter((row) => row.component.isActive)
  if (bom.length === 0) {
    throw validation(`"${assembly.name}" has no bill of materials.`)
  }
  let lineNumber = 0
  for (const row of bom) {
    if (!STOCKED.has(row.component.type)) {
      throw validation(`"${row.component.name}" cannot be used on a work order.`)
    }
    const needed = new Decimal(row.quantity.toString()).times(buildQty)
    await tx.workOrderLine.create({
      data: {
        orgId: ctx.orgId,
        workOrderId,
        lineNumber: ++lineNumber,
        itemId: row.component.id,
        quantity: needed.toFixed(4),
      },
    })
  }
}

export async function create(ctx: OrgContext, input: WorkOrderInput) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const assembly = await tx.item.findFirst({
      where: { id: input.itemId, orgId: ctx.orgId, deletedAt: null },
      select: { id: true, name: true, type: true, isActive: true },
    })
    if (!assembly) throw notFound('Item')
    if (assembly.type !== 'INVENTORY_ASSEMBLY') {
      throw validation(`"${assembly.name}" is not an inventory assembly.`, {
        itemId: ['Choose an inventory assembly'],
      })
    }
    if (!assembly.isActive) {
      throw precondition(`"${assembly.name}" is archived.`)
    }

    const storeId = input.storeId ?? null
    if (storeId) {
      const store = await tx.store.findFirst({
        where: { id: storeId, orgId: ctx.orgId, isActive: true },
        select: { id: true },
      })
      if (!store) throw notFound('Store')
    }

    const number = await assignDocumentNumber(tx, ctx.orgId, 'WORK_ORDER', input.number)
    const clash = await tx.workOrder.findFirst({
      where: { orgId: ctx.orgId, number },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    const qty = new Decimal(input.quantity)
    const wo = await tx.workOrder.create({
      data: {
        orgId: ctx.orgId,
        number,
        date: toDate(input.date),
        dueDate: input.dueDate ? toDate(input.dueDate) : null,
        itemId: assembly.id,
        storeId,
        quantity: qty.toFixed(4),
        memo: input.memo ?? null,
        status: 'DRAFT',
        createdById: ctx.userId,
      },
      select: { id: true, number: true },
    })

    await snapBomLines(tx, ctx, wo.id, assembly.id, qty)

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'WorkOrder',
        entityId: wo.id,
        action: 'CREATE',
        after: { number: wo.number, itemId: assembly.id, quantity: qty.toString() },
      },
      meta,
    )

    return wo
  })
}

export async function release(ctx: OrgContext, id: string) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const wo = await tx.workOrder.findFirst({
      where: { id, orgId: ctx.orgId },
      select: { id: true, number: true, status: true },
    })
    if (!wo) throw notFound('Work order')
    if (!canReleaseWorkOrder(wo.status as WorkOrderStatus)) {
      throw precondition('Only a draft work order can be released.')
    }
    await tx.workOrder.update({
      where: { id: wo.id },
      data: { status: 'RELEASED' },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'WorkOrder',
        entityId: wo.id,
        action: 'UPDATE',
        before: { status: wo.status },
        after: { status: 'RELEASED' },
      },
      meta,
    )
    return { id: wo.id, number: wo.number }
  })
}

export async function cancel(ctx: OrgContext, id: string) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const wo = await tx.workOrder.findFirst({
      where: { id, orgId: ctx.orgId },
      select: { id: true, number: true, status: true },
    })
    if (!wo) throw notFound('Work order')
    if (!canCancelWorkOrder(wo.status as WorkOrderStatus)) {
      throw precondition('This work order cannot be cancelled.')
    }
    await tx.workOrder.update({
      where: { id: wo.id },
      data: { status: 'CANCELLED' },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'WorkOrder',
        entityId: wo.id,
        action: 'UPDATE',
        before: { status: wo.status },
        after: { status: 'CANCELLED' },
      },
      meta,
    )
    return { id: wo.id, number: wo.number }
  })
}

/** Complete a released work order by posting an assembly build in the same transaction. */
export async function complete(ctx: OrgContext, id: string, completeDate?: string) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const wo = await tx.workOrder.findFirst({
      where: { id, orgId: ctx.orgId },
      select: {
        id: true,
        number: true,
        status: true,
        itemId: true,
        storeId: true,
        quantity: true,
        memo: true,
        build: { select: { id: true } },
      },
    })
    if (!wo) throw notFound('Work order')
    if (!canCompleteWorkOrder(wo.status as WorkOrderStatus)) {
      throw precondition('Only a released work order can be completed.')
    }
    if (wo.build) throw precondition('This work order already has a build.')

    const date = completeDate ?? today(ctx.organization.timeZone)
    const built = await assemblyBuildService.createInTx(
      tx,
      ctx,
      {
        number: '',
        date,
        itemId: wo.itemId,
        storeId: wo.storeId,
        quantity: wo.quantity.toString(),
        memo: wo.memo ? `WO ${wo.number} — ${wo.memo}` : `WO ${wo.number}`,
        workOrderId: wo.id,
      },
      meta,
    )

    await tx.workOrder.update({
      where: { id: wo.id },
      data: { status: 'DONE' },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'WorkOrder',
        entityId: wo.id,
        action: 'UPDATE',
        before: { status: wo.status },
        after: { status: 'DONE', buildId: built.id, buildNumber: built.number },
      },
      meta,
    )

    return {
      id: wo.id,
      number: wo.number,
      buildId: built.id,
      buildNumber: built.number,
      unitCost: built.unitCost,
      value: built.value,
    }
  })
}

/** Test helper — complete inside an existing transaction. */
export async function completeInTx(
  tx: Tx,
  ctx: OrgContext,
  id: string,
  completeDate?: string,
  meta?: Awaited<ReturnType<typeof requestMeta>>,
) {
  const audit = meta ?? (await requestMeta())
  const wo = await tx.workOrder.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true,
      number: true,
      status: true,
      itemId: true,
      storeId: true,
      quantity: true,
      memo: true,
      build: { select: { id: true } },
    },
  })
  if (!wo) throw notFound('Work order')
  if (!canCompleteWorkOrder(wo.status as WorkOrderStatus)) {
    throw precondition('Only a released work order can be completed.')
  }
  if (wo.build) throw precondition('This work order already has a build.')

  const date = completeDate ?? today(ctx.organization.timeZone)
  const built = await assemblyBuildService.createInTx(
    tx,
    ctx,
    {
      number: '',
      date,
      itemId: wo.itemId,
      storeId: wo.storeId,
      quantity: wo.quantity.toString(),
      memo: wo.memo ? `WO ${wo.number} — ${wo.memo}` : `WO ${wo.number}`,
      workOrderId: wo.id,
    },
    audit,
  )

  await tx.workOrder.update({
    where: { id: wo.id },
    data: { status: 'DONE' },
  })

  return {
    id: wo.id,
    number: wo.number,
    buildId: built.id,
    buildNumber: built.number,
    unitCost: built.unitCost,
    value: built.value,
  }
}
