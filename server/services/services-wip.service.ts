import 'server-only'

import { Decimal } from '@/lib/money'
import { utilizationPercent, wipFromEntries } from '@/lib/erp/verticals-p5'
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
    where: { orgId: ctx.orgId, billable: true },
    select: {
      userId: true,
      hours: true,
      user: { select: { name: true, email: true } },
    },
    take: 5000,
  })

  const byUser = new Map<string, { name: string; hours: number }>()
  for (const entry of entries) {
    const prior = byUser.get(entry.userId) ?? {
      name: entry.user.name || entry.user.email || entry.userId,
      hours: 0,
    }
    prior.hours += Number(entry.hours.toString())
    byUser.set(entry.userId, prior)
  }

  return [...byUser.entries()].map(([userId, row]) => ({
    userId,
    name: row.name,
    billableHours: row.hours.toFixed(2),
    availableHours: available.toFixed(2),
    utilization: utilizationPercent(row.hours, available),
  }))
}

/** Create a retainer invoice against a project (prepayment memo on the project). */
export async function billRetainer(
  ctx: OrgContext,
  input: { projectId: string; itemId: string; amount: string; description?: string },
) {
  const project = await db.project.findFirst({
    where: { id: input.projectId, orgId: ctx.orgId },
    select: { id: true, name: true, number: true, customerId: true },
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

  return { invoiceId: invoice.id, invoiceNumber: invoice.number }
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
    select: { id: true, name: true, number: true, customerId: true },
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
