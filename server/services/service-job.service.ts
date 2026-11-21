import 'server-only'

import { isCalendarDate, toDate, today } from '@/lib/date'
import { Decimal } from '@/lib/money'
import {
  canCancelServiceJob,
  canCompleteServiceJob,
  canScheduleServiceJob,
  cancelRestoresVanStock,
  type ServiceJobStatus,
} from '@/lib/erp/service-job'
import type { ServiceJobInput } from '@/lib/validation/service-job'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import { assignDocumentNumber, numberTaken } from '@/server/sequences'
import * as inventory from '@/server/services/inventory.service'
import * as salesService from '@/server/services/sales.service'
import * as storeService from '@/server/services/store.service'

async function assertVanStore(tx: Tx, ctx: OrgContext, storeId: string | null | undefined) {
  if (!storeId) return
  const store = await tx.store.findFirst({
    where: { id: storeId, orgId: ctx.orgId, isActive: true },
    select: { id: true, isVan: true, name: true },
  })
  if (!store) throw notFound('Store')
  if (!store.isVan) {
    throw validation(`"${store.name}" is not marked as a van store.`)
  }
}

export async function list(
  ctx: OrgContext,
  filters?: { date?: string; assigneeId?: string },
) {
  const dateRaw = filters?.date?.trim()
  const date = dateRaw && isCalendarDate(dateRaw) ? dateRaw : undefined
  const assigneeId = filters?.assigneeId?.trim()
  const rows = await db.serviceJob.findMany({
    where: {
      orgId: ctx.orgId,
      ...(date ? { date: toDate(date) } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    },
    orderBy: [{ status: 'asc' }, { promisedWindowStart: 'asc' }, { date: 'desc' }],
    include: {
      customer: { select: { displayName: true } },
      assignee: { select: { name: true } },
      vanStore: { select: { name: true } },
      salesDocument: { select: { id: true, number: true } },
    },
    take: 200,
  })
  return rows
}

export async function get(ctx: OrgContext, id: string) {
  const row = await db.serviceJob.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      customer: { select: { id: true, displayName: true } },
      project: { select: { id: true, number: true, name: true } },
      assignee: { select: { id: true, name: true } },
      vanStore: { select: { id: true, name: true } },
      salesDocument: { select: { id: true, number: true, status: true } },
      lines: {
        orderBy: { lineNumber: 'asc' },
        include: {
          item: { select: { id: true, name: true, type: true } },
          vanStore: { select: { id: true, name: true } },
        },
      },
    },
  })
  if (!row) throw notFound('Service job')
  return {
    ...row,
    lines: row.lines.map((line) => ({
      ...line,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
    })),
  }
}

export async function create(ctx: OrgContext, input: ServiceJobInput) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!customer) throw notFound('Customer')

    if (input.projectId) {
      const project = await tx.project.findFirst({
        where: { id: input.projectId, orgId: ctx.orgId },
        select: { id: true, customerId: true },
      })
      if (!project) throw notFound('Project')
      if (project.customerId !== customer.id) {
        throw validation('Project customer must match the service job customer.')
      }
    }

    await assertVanStore(tx, ctx, input.vanStoreId)

    const number = await assignDocumentNumber(tx, ctx.orgId, 'SERVICE_JOB', input.number)
    const clash = await tx.serviceJob.findFirst({
      where: { orgId: ctx.orgId, number },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    let lineNumber = 0
    for (const line of input.lines) {
      if (line.kind === 'PART' && line.vanStoreId) {
        await assertVanStore(tx, ctx, line.vanStoreId)
      }
      if (line.itemId) {
        const item = await tx.item.findFirst({
          where: { id: line.itemId, orgId: ctx.orgId, deletedAt: null, isActive: true },
          select: { id: true },
        })
        if (!item) throw notFound('Item')
      }
    }

    const job = await tx.serviceJob.create({
      data: {
        orgId: ctx.orgId,
        number,
        date: toDate(input.date),
        customerId: customer.id,
        projectId: input.projectId ?? null,
        assigneeId: input.assigneeId ?? null,
        vanStoreId: input.vanStoreId ?? null,
        siteLocation: input.siteLocation?.trim() || null,
        promisedWindowStart: input.promisedWindowStart ?? null,
        promisedWindowEnd: input.promisedWindowEnd ?? null,
        memo: input.memo?.trim() || null,
        status: 'DRAFT',
        createdById: ctx.userId,
        lines: {
          create: input.lines.map((line) => ({
            orgId: ctx.orgId,
            lineNumber: ++lineNumber,
            kind: line.kind,
            itemId: line.itemId ?? null,
            description: line.description?.trim() || null,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            vanStoreId: line.vanStoreId ?? null,
          })),
        },
      },
      select: { id: true, number: true },
    })

    await writeAudit(
      tx,
      ctx,
      { entity: 'ServiceJob', entityId: job.id, action: 'CREATE', after: { number: job.number } },
      meta,
    )
    return job
  })
}

export async function schedule(ctx: OrgContext, id: string, scheduledAt?: Date) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const job = await tx.serviceJob.findFirst({
      where: { id, orgId: ctx.orgId },
      select: { id: true, number: true, status: true },
    })
    if (!job) throw notFound('Service job')
    if (!canScheduleServiceJob(job.status as ServiceJobStatus)) {
      throw precondition('Only draft jobs can be scheduled.')
    }
    await tx.serviceJob.update({
      where: { id: job.id },
      data: {
        status: 'SCHEDULED',
        scheduledAt: scheduledAt ?? new Date(),
      },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ServiceJob',
        entityId: job.id,
        action: 'UPDATE',
        before: { status: job.status },
        after: { status: 'SCHEDULED' },
      },
      meta,
    )
    return { id: job.id, number: job.number }
  })
}

export async function cancel(ctx: OrgContext, id: string) {
  const meta = await requestMeta()
  const job = await db.serviceJob.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, number: true, status: true, salesDocumentId: true },
  })
  if (!job) throw notFound('Service job')
  if (!canCancelServiceJob(job.status as ServiceJobStatus)) {
    throw precondition('This service job cannot be cancelled.')
  }

  if (cancelRestoresVanStock(job.status as ServiceJobStatus, job.salesDocumentId) && job.salesDocumentId) {
    await salesService.remove(ctx, job.salesDocumentId, `Service job ${job.number} cancelled`)
  }

  await db.$transaction(async (tx) => {
    await tx.serviceJob.update({
      where: { id: job.id },
      data: { status: 'CANCELLED', salesDocumentId: null },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ServiceJob',
        entityId: job.id,
        action: 'UPDATE',
        before: { status: job.status },
        after: { status: 'CANCELLED', restoredVanStock: Boolean(job.salesDocumentId) },
      },
      meta,
    )
  })
  return { id: job.id, number: job.number }
}

/** Draft warehouse → van store transfers for PART lines on this job. */
export async function replenishVan(ctx: OrgContext, id: string) {
  const job = await db.serviceJob.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      lines: {
        where: { kind: 'PART' },
        orderBy: { lineNumber: 'asc' },
        include: { item: { select: { id: true, name: true, type: true } } },
      },
    },
  })
  if (!job) throw notFound('Service job')
  if (job.status === 'CANCELLED' || job.status === 'DONE') {
    throw precondition('Only draft or scheduled jobs can replenish the van.')
  }
  const vanStoreId = job.vanStoreId
  if (!vanStoreId) throw validation('Set a van store on the job before replenishing.')

  const warehouse = await db.store.findFirst({
    where: { orgId: ctx.orgId, isActive: true, isVan: false, id: { not: vanStoreId } },
    select: { id: true, name: true, isOffice: true },
    orderBy: [{ isOffice: 'desc' }, { name: 'asc' }],
  })
  if (!warehouse) throw precondition('Add a warehouse or office store to replenish the van from.')

  const lines = job.lines
    .filter((line) => line.itemId && (line.item?.type === 'INVENTORY' || line.item?.type === 'INVENTORY_ASSEMBLY'))
    .map((line) => ({ itemId: line.itemId!, quantity: line.quantity.toString() }))
  if (lines.length === 0) throw validation('This job has no inventory parts to transfer.')

  return inventory.createDraftTransfersToStore(ctx, {
    fromStoreId: warehouse.id,
    toStoreId: vanStoreId,
    memo: `Replenishment draft → van ${job.number}`,
    lines,
  })
}

export async function complete(ctx: OrgContext, id: string) {
  const meta = await requestMeta()
  const job = await db.serviceJob.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      lines: {
        orderBy: { lineNumber: 'asc' },
        include: { item: { select: { id: true, name: true, type: true } } },
      },
    },
  })
  if (!job) throw notFound('Service job')
  if (!canCompleteServiceJob(job.status as ServiceJobStatus)) {
    throw precondition('Only scheduled jobs can be completed.')
  }
  if (job.lines.length === 0) {
    throw validation('Add lines before completing the job.')
  }

  if (!ctx.organization.allowNegativeStock) {
    const shelf = await storeService.quantities(ctx)
    for (const line of job.lines) {
      if (line.kind !== 'PART' || !line.itemId) continue
      if (line.item?.type !== 'INVENTORY' && line.item?.type !== 'INVENTORY_ASSEMBLY') continue
      const storeId = line.vanStoreId ?? job.vanStoreId
      if (!storeId) {
        throw validation(
          `Line ${line.lineNumber} needs a van store to issue stock for "${line.item?.name ?? 'part'}".`,
        )
      }
      const qty = new Decimal(line.quantity.toString())
      const onHand = new Decimal(shelf.byItem[line.itemId]?.[storeId] ?? '0')
      if (qty.greaterThan(onHand)) {
        throw precondition(
          `Van stock short for "${line.item?.name ?? 'part'}": need ${qty.toFixed(2)}, have ${onHand.toFixed(2)}.`,
        )
      }
    }
  }

  const invoiceLines = job.lines.map((line) => {
    const storeId =
      line.kind === 'PART' && line.item?.type === 'INVENTORY'
        ? line.vanStoreId ?? job.vanStoreId
        : null
    const label =
      line.description?.trim() ||
      (line.kind === 'LABOR' ? 'Labour' : line.kind === 'TRAVEL' ? 'Travel' : line.item?.name ?? 'Part')
    if (line.kind === 'LABOR' || line.kind === 'TRAVEL') {
      if (!line.itemId) throw validation(`Line ${line.lineNumber} (${line.kind}) needs an item.`)
    } else if (!line.itemId) {
      throw validation(`Line ${line.lineNumber} needs an item.`)
    }
    return {
      itemId: line.itemId,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      description: label,
      storeId: storeId ?? undefined,
    }
  })

  const invoice = await salesService.create(ctx, 'INVOICE', {
    number: undefined,
    customerId: job.customerId,
    date: today(ctx.organization.timeZone),
    projectId: job.projectId ?? undefined,
    lines: invoiceLines,
    saveAsDraft: false,
    acknowledgeCreditLimit: false,
    discountKind: 'percent',
    customerMessage: job.memo ? `Service job ${job.number} — ${job.memo}` : `Service job ${job.number}`,
  })

  await db.$transaction(async (tx) => {
    await tx.serviceJob.update({
      where: { id: job.id },
      data: {
        status: 'DONE',
        completedAt: new Date(),
        salesDocumentId: invoice.id,
      },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ServiceJob',
        entityId: job.id,
        action: 'UPDATE',
        before: { status: job.status },
        after: { status: 'DONE', invoiceId: invoice.id, invoiceNumber: invoice.number },
      },
      meta,
    )
  })

  return {
    id: job.id,
    number: job.number,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
  }
}