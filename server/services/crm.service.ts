import 'server-only'

import type { CrmActivityKind, CrmOpportunityStage } from '@prisma/client'

import { toDate, type CalendarDate } from '@/lib/date'
import { canMoveOpportunity, type CrmStage } from '@/lib/erp/crm-pipeline'
import { Decimal } from '@/lib/money'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'

export async function listBoard(ctx: OrgContext) {
  assertPermission(ctx, 'customer:read')
  const [opportunities, activities, customers] = await Promise.all([
    db.crmOpportunity.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { updatedAt: 'desc' },
      take: 80,
      include: { customer: { select: { id: true, displayName: true } } },
    }),
    db.crmActivity.findMany({
      where: { orgId: ctx.orgId },
      orderBy: [{ doneAt: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 80,
      include: { customer: { select: { id: true, displayName: true } } },
    }),
    db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 200,
    }),
  ])
  return {
    opportunities: opportunities.map((row) => ({
      ...row,
      amount: row.amount?.toString() ?? null,
    })),
    activities,
    customers,
  }
}

export async function createOpportunity(
  ctx: OrgContext,
  input: {
    customerId: string
    title: string
    amount?: string | null
    expectedClose?: CalendarDate | null
    notes?: string | null
  },
) {
  assertPermission(ctx, 'customer:update')
  const customer = await db.customer.findFirst({
    where: { id: input.customerId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!customer) throw notFound('Customer')
  const title = input.title.trim()
  if (!title) throw validation('Name the opportunity.')
  return db.crmOpportunity.create({
    data: {
      orgId: ctx.orgId,
      customerId: customer.id,
      title,
      amount: input.amount ? new Decimal(input.amount).toFixed(4) : null,
      expectedClose: input.expectedClose ? toDate(input.expectedClose) : null,
      notes: input.notes?.trim() || null,
    },
    select: { id: true, title: true },
  })
}

export async function moveOpportunity(
  ctx: OrgContext,
  input: { id: string; stage: CrmOpportunityStage },
) {
  assertPermission(ctx, 'customer:update')
  const row = await db.crmOpportunity.findFirst({
    where: { id: input.id, orgId: ctx.orgId },
    select: { id: true, stage: true },
  })
  if (!row) throw notFound('Opportunity')
  if (!canMoveOpportunity(row.stage as CrmStage, input.stage as CrmStage)) {
    throw precondition(`Cannot move from ${row.stage} to ${input.stage}.`)
  }
  return db.crmOpportunity.update({
    where: { id: row.id },
    data: { stage: input.stage },
    select: { id: true, stage: true },
  })
}

export async function logActivity(
  ctx: OrgContext,
  input: {
    customerId: string
    opportunityId?: string | null
    kind: CrmActivityKind
    subject: string
    dueAt?: string | null
    notes?: string | null
  },
) {
  assertPermission(ctx, 'customer:update')
  const customer = await db.customer.findFirst({
    where: { id: input.customerId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!customer) throw notFound('Customer')
  const subject = input.subject.trim()
  if (!subject) throw validation('Give the follow-up a subject.')
  return db.crmActivity.create({
    data: {
      orgId: ctx.orgId,
      customerId: customer.id,
      opportunityId: input.opportunityId || null,
      createdById: ctx.userId,
      kind: input.kind,
      subject,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      notes: input.notes?.trim() || null,
    },
    select: { id: true },
  })
}

export async function completeActivity(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'customer:update')
  const row = await db.crmActivity.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, doneAt: true },
  })
  if (!row) throw notFound('Activity')
  if (row.doneAt) return { id: row.id, alreadyDone: true as const }
  return db.crmActivity.update({
    where: { id: row.id },
    data: { doneAt: new Date() },
    select: { id: true, doneAt: true },
  })
}
