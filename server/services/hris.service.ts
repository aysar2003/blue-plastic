import 'server-only'

import type { ApplicantStatus } from '@prisma/client'

import {
  canHireApplicant,
  canMoveApplicant,
  canRejectApplicant,
  type ApplicantStage,
} from '@/lib/erp/applicant-pipeline'
import { Decimal } from '@/lib/money'
import { toCalendarDate, toDate, today } from '@/lib/date'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'

/** Left / inactive employees cannot enter new payroll. */
export async function assertEmployeePayrollEligible(ctx: OrgContext, employeeId: string) {
  const employee = await db.employee.findFirst({
    where: { id: employeeId, orgId: ctx.orgId },
    select: { id: true, name: true, active: true, leftAt: true, lifecycleStatus: true },
  })
  if (!employee) throw notFound('Employee')
  if (employee.lifecycleStatus === 'LEFT' || !employee.active || employee.leftAt) {
    throw precondition(
      `${employee.name} has left (or is inactive) and cannot be added to a new payroll run.`,
    )
  }
  return employee
}

export async function setEmploymentLifecycle(
  ctx: OrgContext,
  input: { employeeId: string; status: 'DRAFT' | 'ACTIVE' | 'LEFT'; leftAt?: string | null },
) {
  assertPermission(ctx, 'hr:update')
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!employee) throw notFound('Employee')

  if (input.status === 'DRAFT') {
    return db.employee.update({
      where: { id: employee.id },
      data: {
        lifecycleStatus: 'DRAFT',
        active: false,
        leftAt: null,
      },
      select: { id: true, active: true, leftAt: true, lifecycleStatus: true },
    })
  }
  if (input.status === 'ACTIVE') {
    return db.employee.update({
      where: { id: employee.id },
      data: {
        lifecycleStatus: 'ACTIVE',
        active: true,
        leftAt: null,
        hiredAt: toDate(today(ctx.organization.timeZone)),
      },
      select: { id: true, active: true, leftAt: true, lifecycleStatus: true },
    })
  }
  return db.employee.update({
    where: { id: employee.id },
    data: {
      lifecycleStatus: 'LEFT',
      active: false,
      leftAt: toDate(input.leftAt || today(ctx.organization.timeZone)),
    },
    select: { id: true, active: true, leftAt: true, lifecycleStatus: true },
  })
}

export async function createJobOpening(
  ctx: OrgContext,
  input: { title: string; department?: string | null; description?: string | null },
) {
  assertPermission(ctx, 'hr:update')
  return db.jobOpening.create({
    data: {
      orgId: ctx.orgId,
      title: input.title.trim(),
      department: input.department?.trim() || null,
      description: input.description?.trim() || null,
    },
    select: { id: true, title: true },
  })
}

export async function createApplicant(
  ctx: OrgContext,
  input: {
    jobOpeningId: string
    name: string
    email?: string | null
    phone?: string | null
    notes?: string | null
  },
) {
  assertPermission(ctx, 'hr:update')
  const job = await db.jobOpening.findFirst({
    where: { id: input.jobOpeningId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!job) throw notFound('Job opening')
  return db.applicant.create({
    data: {
      orgId: ctx.orgId,
      jobOpeningId: job.id,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
    },
    select: { id: true, name: true },
  })
}

/** Hire path: applicant → employee card, mark hired, close opening. */
export async function hireApplicant(ctx: OrgContext, applicantId: string) {
  assertPermission(ctx, 'hr:update')
  return db.$transaction(async (tx) => {
    const applicant = await tx.applicant.findFirst({
      where: { id: applicantId, orgId: ctx.orgId },
      include: { jobOpening: { select: { id: true, title: true, department: true } } },
    })
    if (!applicant) throw notFound('Applicant')
    if (applicant.status === 'HIRED' && applicant.employeeId) {
      return { employeeId: applicant.employeeId, alreadyHired: true as const }
    }
    if (!canHireApplicant(applicant.status as ApplicantStage)) {
      throw precondition('Move the applicant to Offer before hiring.')
    }

    const employee = await tx.employee.create({
      data: {
        orgId: ctx.orgId,
        name: applicant.name,
        workEmail: applicant.email,
        mobile: applicant.phone,
        jobTitle: applicant.jobOpening.title,
        department: applicant.jobOpening.department,
        active: true,
        lifecycleStatus: 'ACTIVE',
        hiredAt: toDate(today(ctx.organization.timeZone)),
        notes: applicant.notes,
      },
      select: { id: true, name: true },
    })

    await tx.applicant.update({
      where: { id: applicant.id },
      data: { status: 'HIRED', employeeId: employee.id },
    })
    await tx.jobOpening.update({
      where: { id: applicant.jobOpeningId },
      data: { status: 'FILLED' },
    })

    return { employeeId: employee.id, name: employee.name, alreadyHired: false as const }
  })
}

/** After hire: a to-do so HR finishes contracts, access, and payroll. */
export async function queueOnboarding(ctx: OrgContext, employee: { id: string; name: string }) {
  await db.workspaceTodo.create({
    data: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      assigneeId: ctx.userId,
      title: `Onboard ${employee.name}`,
      notes: 'Contract, email/login, payroll, and equipment.',
      stage: 'OPEN',
      sequence: 0,
    },
  })
}

export async function moveApplicant(
  ctx: OrgContext,
  input: { applicantId: string; status: ApplicantStatus },
) {
  assertPermission(ctx, 'hr:update')
  const applicant = await db.applicant.findFirst({
    where: { id: input.applicantId, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!applicant) throw notFound('Applicant')
  if (input.status === 'HIRED') {
    return hireApplicant(ctx, applicant.id)
  }
  if (!canMoveApplicant(applicant.status as ApplicantStage, input.status as ApplicantStage)) {
    throw precondition(`Cannot move from ${applicant.status} to ${input.status}.`)
  }
  return db.applicant.update({
    where: { id: applicant.id },
    data: { status: input.status },
    select: { id: true, status: true },
  })
}

export async function rejectApplicant(ctx: OrgContext, applicantId: string) {
  assertPermission(ctx, 'hr:update')
  const applicant = await db.applicant.findFirst({
    where: { id: applicantId, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!applicant) throw notFound('Applicant')
  if (!canRejectApplicant(applicant.status as ApplicantStage)) {
    throw precondition('This applicant cannot be rejected.')
  }
  return db.applicant.update({
    where: { id: applicant.id },
    data: { status: 'REJECTED' },
    select: { id: true, status: true },
  })
}

export async function reopenOpening(ctx: OrgContext, jobOpeningId: string) {
  assertPermission(ctx, 'hr:update')
  const job = await db.jobOpening.findFirst({
    where: { id: jobOpeningId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!job) throw notFound('Job opening')
  return db.jobOpening.update({
    where: { id: job.id },
    data: { status: 'OPEN' },
    select: { id: true, status: true },
  })
}

export async function createAppraisal(
  ctx: OrgContext,
  input: {
    employeeId: string
    periodLabel: string
    score?: string | null
    notes?: string | null
    goals?: string | null
    competencies?: Record<string, string> | null
    reviewedAt?: string | null
  },
) {
  assertPermission(ctx, 'hr:update')
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!employee) throw notFound('Employee')
  let score: string | null = null
  if (input.score != null && input.score !== '') {
    const n = new Decimal(input.score)
    if (n.isNegative() || n.greaterThan(100)) throw validation('Score must be 0–100.')
    score = n.toFixed(2)
  }
  return db.appraisal.create({
    data: {
      orgId: ctx.orgId,
      employeeId: employee.id,
      periodLabel: input.periodLabel.trim(),
      score,
      notes: input.notes?.trim() || null,
      goals: input.goals?.trim() || null,
      competencies: input.competencies ?? undefined,
      reviewedAt: input.reviewedAt ? toDate(input.reviewedAt) : null,
    },
    select: { id: true, periodLabel: true },
  })
}

/** Copy wage from active contract onto the employee card. */
export async function syncWageFromActiveContract(ctx: OrgContext, employeeId: string) {
  assertPermission(ctx, 'hr:update')
  const contract = await db.employeeContract.findFirst({
    where: { orgId: ctx.orgId, employeeId, state: 'OPEN' },
    orderBy: { dateStart: 'desc' },
    select: { wageAmount: true, wageType: true },
  })
  if (!contract) throw precondition('No open contract with a wage to sync.')
  return db.employee.update({
    where: { id: employeeId },
    data: { wageAmount: contract.wageAmount, wageType: contract.wageType },
    select: { id: true, wageAmount: true, wageType: true },
  })
}

export async function listRecruitment(ctx: OrgContext) {
  assertPermission(ctx, 'hr:read')
  const [openings, applicants, appraisals] = await Promise.all([
    db.jobOpening.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    }),
    db.applicant.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { updatedAt: 'desc' },
      take: 40,
      include: { jobOpening: { select: { title: true } }, employee: { select: { id: true, name: true } } },
    }),
    db.appraisal.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { updatedAt: 'desc' },
      take: 40,
      include: { employee: { select: { id: true, name: true } } },
    }),
  ])
  return {
    openings,
    applicants,
    appraisals: appraisals.map((row) => ({
      ...row,
      score: row.score?.toString() ?? null,
      reviewedAt: row.reviewedAt ? toCalendarDate(row.reviewedAt) : null,
    })),
  }
}
