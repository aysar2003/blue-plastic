import 'server-only'

import type { InsuranceClaimStatus } from '@prisma/client'

import { toCalendarDate, toDate, today, type CalendarDate } from '@/lib/date'
import { Decimal } from '@/lib/money'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import * as recurringService from '@/server/services/recurring.service'

function isPastEnd(endDate: Date, asOf: CalendarDate): boolean {
  return toCalendarDate(endDate) < asOf
}

async function syncLapsedIfNeeded(
  row: { id: string; status: string; endDate: Date },
  asOf: CalendarDate,
) {
  if (row.status === 'ACTIVE' && isPastEnd(row.endDate, asOf)) {
    await db.insurancePolicy.update({
      where: { id: row.id },
      data: { status: 'LAPSED' },
    })
    return 'LAPSED' as const
  }
  return row.status as 'ACTIVE' | 'LAPSED'
}

export async function listPolicies(ctx: OrgContext) {
  assertPermission(ctx, 'customer:read')
  const asOf = today(ctx.organization.timeZone)
  const rows = await db.insurancePolicy.findMany({
    where: { orgId: ctx.orgId },
    include: {
      customer: { select: { id: true, displayName: true } },
      recurringTemplate: { select: { id: true, name: true, isActive: true } },
      claims: { orderBy: { claimedOn: 'desc' }, take: 8 },
    },
    orderBy: { endDate: 'desc' },
    take: 100,
  })
  const out = []
  for (const row of rows) {
    const status = await syncLapsedIfNeeded(row, asOf)
    out.push({ ...row, status })
  }
  return out
}

export async function getPolicy(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'customer:read')
  const row = await db.insurancePolicy.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      customer: { select: { id: true, displayName: true } },
      recurringTemplate: { select: { id: true, name: true, isActive: true } },
    },
  })
  if (!row) throw notFound('Policy')
  const status = await syncLapsedIfNeeded(row, today(ctx.organization.timeZone))
  return { ...row, status }
}

export async function createPolicy(
  ctx: OrgContext,
  input: {
    customerId: string
    policyNumber: string
    premium: string
    startDate: string
    endDate: string
    coverStart?: string | null
    coverEnd?: string | null
    recurringTemplateId?: string | null
    notes?: string | null
  },
) {
  assertPermission(ctx, 'customer:create')
  const premium = new Decimal(input.premium)
  if (premium.lessThan(0)) throw validation('Premium cannot be negative.')
  const coverStart = input.coverStart || input.startDate
  const coverEnd = input.coverEnd || input.endDate
  return db.insurancePolicy.create({
    data: {
      orgId: ctx.orgId,
      customerId: input.customerId,
      policyNumber: input.policyNumber.trim(),
      premium: premium.toFixed(4),
      startDate: toDate(input.startDate),
      endDate: toDate(input.endDate),
      coverStart: toDate(coverStart),
      coverEnd: toDate(coverEnd),
      status: 'ACTIVE',
      recurringTemplateId: input.recurringTemplateId || null,
      notes: input.notes?.trim() || null,
    },
  })
}

export async function updatePolicyStatus(
  ctx: OrgContext,
  id: string,
  status: 'ACTIVE' | 'LAPSED',
) {
  assertPermission(ctx, 'customer:update')
  const row = await db.insurancePolicy.findFirst({ where: { id, orgId: ctx.orgId }, select: { id: true } })
  if (!row) throw notFound('Policy')
  return db.insurancePolicy.update({ where: { id: row.id }, data: { status } })
}

export async function linkRecurring(ctx: OrgContext, id: string, recurringTemplateId: string | null) {
  assertPermission(ctx, 'customer:update')
  const row = await db.insurancePolicy.findFirst({ where: { id, orgId: ctx.orgId }, select: { id: true } })
  if (!row) throw notFound('Policy')
  if (recurringTemplateId) {
    const template = await db.recurringTemplate.findFirst({
      where: { id: recurringTemplateId, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!template) throw notFound('Recurring template')
  }
  return db.insurancePolicy.update({
    where: { id: row.id },
    data: { recurringTemplateId },
  })
}

export async function createPremiumRecurring(ctx: OrgContext, policyId: string) {
  assertPermission(ctx, 'invoice:create')
  const policy = await getPolicy(ctx, policyId)
  if (policy.recurringTemplateId) {
    throw precondition('This policy already has a recurring invoice template.')
  }
  const serviceItem = await db.item.findFirst({
    where: { orgId: ctx.orgId, type: 'SERVICE', isActive: true, deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true },
  })
  if (!serviceItem) {
    throw precondition('Add an active service item before billing insurance premiums.')
  }
  const nextRun = toCalendarDate(policy.startDate)
  const template = await recurringService.create(ctx, {
    name: `Insurance ${policy.policyNumber}`,
    type: 'INVOICE',
    frequency: 'MONTHLY',
    interval: 1,
    nextRunOn: nextRun,
    endOn: toCalendarDate(policy.endDate),
    isActive: true,
    deferRevenue: false,
    serviceMonths: null,
    customerId: policy.customerId,
    itemId: serviceItem.id,
    amount: policy.premium.toString(),
    lineDescription: `Insurance premium · ${policy.policyNumber}`,
    memo: policy.notes ?? undefined,
  })
  await db.insurancePolicy.update({
    where: { id: policy.id },
    data: { recurringTemplateId: template.id },
  })
  return { policyId: policy.id, recurringTemplateId: template.id, templateName: template.name }
}

export async function listClaims(ctx: OrgContext, policyId?: string) {
  assertPermission(ctx, 'customer:read')
  const rows = await db.insuranceClaim.findMany({
    where: { orgId: ctx.orgId, ...(policyId ? { policyId } : {}) },
    include: {
      policy: { select: { policyNumber: true, customer: { select: { displayName: true } } } },
    },
    orderBy: { claimedOn: 'desc' },
    take: 100,
  })
  return rows.map((row) => ({
    ...row,
    amount: row.amount.toString(),
    claimedOn: toCalendarDate(row.claimedOn),
  }))
}

export async function registerClaim(
  ctx: OrgContext,
  input: {
    policyId: string
    amount: string
    payer?: string | null
    notes?: string | null
    claimedOn: string
    status?: InsuranceClaimStatus
  },
) {
  assertPermission(ctx, 'customer:create')
  const policy = await db.insurancePolicy.findFirst({
    where: { id: input.policyId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!policy) throw notFound('Policy')
  const amount = new Decimal(input.amount)
  if (amount.lessThan(0)) throw validation('Claim amount cannot be negative.')
  return db.insuranceClaim.create({
    data: {
      orgId: ctx.orgId,
      policyId: policy.id,
      amount: amount.toFixed(4),
      payer: input.payer?.trim() || null,
      notes: input.notes?.trim() || null,
      claimedOn: toDate(input.claimedOn),
      status: input.status ?? 'OPEN',
    },
    select: { id: true, amount: true, status: true },
  })
}

export async function setClaimStatus(
  ctx: OrgContext,
  id: string,
  status: InsuranceClaimStatus,
) {
  assertPermission(ctx, 'customer:update')
  const row = await db.insuranceClaim.findFirst({ where: { id, orgId: ctx.orgId }, select: { id: true } })
  if (!row) throw notFound('Claim')
  return db.insuranceClaim.update({ where: { id: row.id }, data: { status } })
}