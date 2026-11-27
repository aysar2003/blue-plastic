import 'server-only'

import { Decimal } from '@/lib/money'
import {
  replenishRetainerRemaining,
  utilizationAvailableHours,
  utilizationPercent,
  wipAgeBucket,
  wipFromEntries,
  type WipAgeBucket,
} from '@/lib/erp/verticals-p5'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import { today } from '@/lib/date'
import * as projectTime from '@/server/services/project-time.service'
import * as salesService from '@/server/services/sales.service'

export async function projectWip(ctx: OrgContext, projectId?: string) {
  const projects = await db.project.findMany({
    where: {
      orgId: ctx.orgId,
      ...(projectId ? { id: projectId } : {}),
      status: { in: ['DRAFT', 'ACTIVE', 'ON_HOLD'] },
    },
    select: {
      id: true,
      number: true,
      name: true,
      customerId: true,
      retainerAmount: true,
      retainerRemaining: true,
      timeEntries: {
        where: { billable: true, invoicedAt: null },
        select: { hours: true, billableRate: true, billable: true, invoicedAt: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  return projects.map((project) => {
    const wip = wipFromEntries(
      project.timeEntries.map((entry) => ({
        hours: entry.hours.toString(),
        billableRate: entry.billableRate?.toString() ?? null,
        billable: entry.billable,
        invoicedAt: entry.invoicedAt?.toISOString() ?? null,
      })),
    )
    return {
      id: project.id,
      number: project.number,
      name: project.name,
      customerId: project.customerId,
      retainerAmount: project.retainerAmount?.toString() ?? null,
      retainerBalance: project.retainerRemaining?.toString() ?? null,
      retainerRemaining: project.retainerRemaining?.toString() ?? project.retainerAmount?.toString() ?? null,
      wipHours: wip.hours,
      wipAmount: wip.amount,
      wipEntries: wip.entryCount,
    }
  })
}

export async function utilizationReport(
  ctx: OrgContext,
  options: { availableHoursPerPerson?: number } = {},
) {
  const available = options.availableHoursPerPerson ?? 40
  const entries = await db.projectTimeEntry.findMany({
    where: { orgId: ctx.orgId },
    select: {
      userId: true,
      employeeId: true,
      hours: true,
      billable: true,
      user: { select: { name: true, email: true } },
      employee: { select: { name: true } },
    },
    take: 5000,
  })

  const byUser = new Map<string, { name: string; billable: number; total: number }>()
  for (const entry of entries) {
    const workerId = entry.userId ?? entry.employeeId
    if (!workerId) continue
    const prior = byUser.get(workerId) ?? {
      name:
        entry.user?.name ||
        entry.user?.email ||
        entry.employee?.name ||
        workerId,
      billable: 0,
      total: 0,
    }
    const hours = Number(entry.hours.toString())
    if (!Number.isFinite(hours) || hours <= 0) continue
    prior.total += hours
    if (entry.billable) prior.billable += hours
    byUser.set(workerId, prior)
  }

  return [...byUser.entries()].map(([userId, row]) => {
    const availableHours = utilizationAvailableHours(row.total, available)
    return {
      userId,
      name: row.name,
      billableHours: row.billable.toFixed(2),
      availableHours: availableHours.toFixed(2),
      utilization: utilizationPercent(row.billable, availableHours),
    }
  })
}

export async function wipAging(ctx: OrgContext) {
  const asOf = today(ctx.organization.timeZone)
  const entries = await db.projectTimeEntry.findMany({
    where: { orgId: ctx.orgId, billable: true, invoicedAt: null },
    select: {
      hours: true,
      billableRate: true,
      workDate: true,
      project: { select: { id: true, number: true, name: true } },
    },
    take: 5000,
  })

  const buckets: Record<WipAgeBucket, { hours: Decimal; amount: Decimal; entries: number }> = {
    '0-30': { hours: new Decimal(0), amount: new Decimal(0), entries: 0 },
    '31-60': { hours: new Decimal(0), amount: new Decimal(0), entries: 0 },
    '61-90': { hours: new Decimal(0), amount: new Decimal(0), entries: 0 },
    '90+': { hours: new Decimal(0), amount: new Decimal(0), entries: 0 },
  }
  const byProject = new Map<
    string,
    { number: string; name: string; hours: Decimal; amount: Decimal; oldest: WipAgeBucket }
  >()

  for (const entry of entries) {
    const hours = new Decimal(entry.hours.toString())
    const rate = new Decimal(entry.billableRate?.toString() ?? '0')
    const amount = hours.times(rate)
    const bucket = wipAgeBucket(entry.workDate, asOf)
    buckets[bucket].hours = buckets[bucket].hours.plus(hours)
    buckets[bucket].amount = buckets[bucket].amount.plus(amount)
    buckets[bucket].entries += 1
    const prior = byProject.get(entry.project.id) ?? {
      number: entry.project.number,
      name: entry.project.name,
      hours: new Decimal(0),
      amount: new Decimal(0),
      oldest: bucket,
    }
    prior.hours = prior.hours.plus(hours)
    prior.amount = prior.amount.plus(amount)
    const order: WipAgeBucket[] = ['0-30', '31-60', '61-90', '90+']
    if (order.indexOf(bucket) > order.indexOf(prior.oldest)) prior.oldest = bucket
    byProject.set(entry.project.id, prior)
  }

  return {
    asOf,
    buckets: (Object.keys(buckets) as WipAgeBucket[]).map((key) => ({
      bucket: key,
      hours: buckets[key].hours.toFixed(2),
      amount: buckets[key].amount.toFixed(2),
      entries: buckets[key].entries,
    })),
    projects: [...byProject.entries()].map(([projectId, row]) => ({
      projectId,
      number: row.number,
      name: row.name,
      hours: row.hours.toFixed(2),
      amount: row.amount.toFixed(2),
      oldest: row.oldest,
    })),
  }
}

/** Create a retainer invoice against a project (prepayment memo on the project). */
export async function billRetainer(
  ctx: OrgContext,
  input: { projectId: string; itemId: string; amount: string; description?: string },
) {
  const project = await db.project.findFirst({
    where: { id: input.projectId, orgId: ctx.orgId },
    select: {
      id: true,
      name: true,
      number: true,
      customerId: true,
      retainerAmount: true,
      retainerRemaining: true,
    },
  })
  if (!project) throw notFound('Project')

  const amount = new Decimal(input.amount || '0')
  if (amount.lessThanOrEqualTo(0)) throw validation('Retainer amount must be more than zero.')

  const item = await db.item.findFirst({
    where: { id: input.itemId, orgId: ctx.orgId, isActive: true, deletedAt: null },
    select: { id: true },
  })
  if (!item) throw notFound('Service item')

  // Contracted retainerAmount stays on the project; the invoice is the bill record.
  const invoice = await salesService.create(ctx, 'INVOICE', {
    number: undefined,
    customerId: project.customerId,
    date: today(ctx.organization.timeZone),
    projectId: project.id,
    lines: [
      {
        itemId: item.id,
        quantity: '1',
        unitPrice: amount.toFixed(4),
        description:
          input.description?.trim() || `Retainer · ${project.number} ${project.name}`,
      },
    ],
    saveAsDraft: false,
    acknowledgeCreditLimit: false,
    discountKind: 'percent',
    customerMessage: `Retainer for ${project.name}`,
  })

  const prior =
    project.retainerRemaining != null
      ? new Decimal(project.retainerRemaining.toString())
      : project.retainerAmount != null
        ? new Decimal(project.retainerAmount.toString())
        : amount
  const next = Decimal.max(prior.minus(amount), new Decimal(0))
  await db.project.update({
    where: { id: project.id },
    data: { retainerRemaining: next.toFixed(4) },
  })

  return { invoiceId: invoice.id, invoiceNumber: invoice.number, retainerRemaining: next.toFixed(4) }
}

/**
 * Top up a project retainer: invoice posts, then revenue is deferred to unearned
 * and retainerRemaining increases.
 */
export async function replenishRetainer(
  ctx: OrgContext,
  input: { projectId: string; itemId: string; amount: string; description?: string },
) {
  const project = await db.project.findFirst({
    where: { id: input.projectId, orgId: ctx.orgId },
    select: {
      id: true,
      name: true,
      number: true,
      customerId: true,
      retainerAmount: true,
      retainerRemaining: true,
    },
  })
  if (!project) throw notFound('Project')

  const amount = new Decimal(input.amount || '0')
  if (amount.lessThanOrEqualTo(0)) throw validation('Replenish amount must be more than zero.')

  const item = await db.item.findFirst({
    where: { id: input.itemId, orgId: ctx.orgId, isActive: true, deletedAt: null },
    select: { id: true },
  })
  if (!item) throw notFound('Service item')

  const invoice = await salesService.create(ctx, 'INVOICE', {
    number: undefined,
    customerId: project.customerId,
    date: today(ctx.organization.timeZone),
    projectId: project.id,
    lines: [
      {
        itemId: item.id,
        quantity: '1',
        unitPrice: amount.toFixed(4),
        description:
          input.description?.trim() || `Retainer replenish · ${project.number} ${project.name}`,
      },
    ],
    saveAsDraft: false,
    acknowledgeCreditLimit: false,
    discountKind: 'percent',
    customerMessage: `Retainer replenish for ${project.name}`,
  })

  const { deferPostedInvoice } = await import('@/server/services/deferred-revenue.service')
  await deferPostedInvoice(ctx, {
    salesDocumentId: invoice.id,
    serviceMonths: 12,
    runOn: today(ctx.organization.timeZone),
  })

  const prior =
    project.retainerRemaining != null
      ? project.retainerRemaining.toString()
      : project.retainerAmount != null
        ? project.retainerAmount.toString()
        : '0'
  const next = replenishRetainerRemaining(prior, amount.toFixed(4))
  await db.project.update({
    where: { id: project.id },
    data: {
      retainerRemaining: next,
      retainerAmount: project.retainerAmount ?? amount,
    },
  })

  return { invoiceId: invoice.id, invoiceNumber: invoice.number, retainerRemaining: next }
}

/** Invoice unbilled billable time on a project, then mark those entries invoiced. */
export async function billWipFromTime(
  ctx: OrgContext,
  input: {
    projectId: string
    itemId: string
    entryIds?: string[]
    /** Write-up (+) or write-down (−) percent applied to each line’s rate. */
    writeUpDownPercent?: string | number
  },
) {
  const project = await db.project.findFirst({
    where: { id: input.projectId, orgId: ctx.orgId },
    select: {
      id: true,
      name: true,
      number: true,
      customerId: true,
      retainerRemaining: true,
      retainerAmount: true,
    },
  })
  if (!project) throw notFound('Project')

  const item = await db.item.findFirst({
    where: { id: input.itemId, orgId: ctx.orgId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  })
  if (!item) throw notFound('Service item')

  const entries = await db.projectTimeEntry.findMany({
    where: {
      orgId: ctx.orgId,
      projectId: project.id,
      billable: true,
      invoicedAt: null,
      ...(input.entryIds?.length ? { id: { in: input.entryIds } } : {}),
    },
    select: {
      id: true,
      hours: true,
      billableRate: true,
      description: true,
      workDate: true,
    },
    orderBy: { workDate: 'asc' },
    take: 500,
  })
  if (entries.length === 0) {
    throw precondition('No unbilled billable time on this project.')
  }

  const adjustPct = Number(input.writeUpDownPercent ?? 0)
  if (!Number.isFinite(adjustPct) || adjustPct < -100 || adjustPct > 500) {
    throw validation('Write-up / write-down percent must be between -100 and 500.')
  }
  const factor = new Decimal(1).plus(new Decimal(adjustPct).div(100))

  const wipPreview = wipFromEntries(
    entries.map((entry) => ({
      hours: entry.hours.toString(),
      billableRate: entry.billableRate?.toString() ?? null,
      billable: true,
      invoicedAt: null,
    })),
  )
  const remaining =
    project.retainerRemaining != null
      ? new Decimal(project.retainerRemaining.toString())
      : project.retainerAmount != null
        ? new Decimal(project.retainerAmount.toString())
        : null
  if (
    remaining != null &&
    remaining.greaterThan(0) &&
    new Decimal(wipPreview.amount).greaterThan(remaining)
  ) {
    throw precondition(
      `WIP to bill (${wipPreview.amount}) exceeds retainer remaining (${remaining.toFixed(2)}).`,
    )
  }

  const lines = entries.map((entry) => {
    const hours = new Decimal(entry.hours.toString())
    const rate = new Decimal(entry.billableRate?.toString() ?? '0').times(factor)
    if (hours.lessThanOrEqualTo(0)) {
      throw validation('Time entries need hours greater than zero.')
    }
    const note =
      adjustPct !== 0
        ? ` (${adjustPct > 0 ? '+' : ''}${adjustPct}% write-${adjustPct >= 0 ? 'up' : 'down'})`
        : ''
    return {
      itemId: item.id,
      quantity: hours.toFixed(4),
      unitPrice: rate.toFixed(4),
      description:
        (entry.description?.trim() ||
          `${item.name} · ${project.number} · ${entry.workDate.toISOString().slice(0, 10)}`) + note,
      serviceDate: entry.workDate.toISOString().slice(0, 10),
    }
  })

  const invoice = await salesService.create(ctx, 'INVOICE', {
    number: undefined,
    customerId: project.customerId,
    date: today(ctx.organization.timeZone),
    projectId: project.id,
    lines,
    saveAsDraft: false,
    acknowledgeCreditLimit: false,
    discountKind: 'percent',
    customerMessage: `WIP time · ${project.name}`,
  })

  await projectTime.markInvoiced(
    ctx,
    entries.map((entry) => entry.id),
  )

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    entryCount: entries.length,
    writeUpDownPercent: adjustPct,
  }
}
