import 'server-only'

import { toDate, type CalendarDate } from '@/lib/date'
import { money } from '@/lib/money'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound } from '@/server/errors'

export async function listForEmployee(ctx: OrgContext, employeeId: string) {
  assertPermission(ctx, 'hr:read')
  return db.appraisal.findMany({
    where: { orgId: ctx.orgId, employeeId },
    orderBy: { reviewedAt: 'desc' },
  })
}

export async function create(
  ctx: OrgContext,
  input: {
    employeeId: string
    periodLabel: string
    score?: string | null
    notes?: string | null
    reviewedAt?: CalendarDate | null
  },
) {
  assertPermission(ctx, 'hr:update')
  const emp = await db.employee.findFirst({
    where: { id: input.employeeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!emp) throw notFound('Employee')

  return db.appraisal.create({
    data: {
      orgId: ctx.orgId,
      employeeId: input.employeeId,
      periodLabel: input.periodLabel.trim(),
      score: input.score ? money(input.score) : null,
      notes: input.notes?.trim() || null,
      reviewedAt: input.reviewedAt ? toDate(input.reviewedAt) : null,
    },
  })
}
