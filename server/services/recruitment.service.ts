import 'server-only'

import { employeeCreateSchema } from '@/lib/validation/employee'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound } from '@/server/errors'
import * as employeeService from '@/server/services/employee.service'

export async function listOpenings(ctx: OrgContext) {
  assertPermission(ctx, 'hr:read')
  return db.jobOpening.findMany({
    where: { orgId: ctx.orgId },
    include: { _count: { select: { applicants: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })
}

export async function createOpening(
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
  })
}

export async function listApplicants(ctx: OrgContext, jobOpeningId: string) {
  assertPermission(ctx, 'hr:read')
  return db.applicant.findMany({
    where: { orgId: ctx.orgId, jobOpeningId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function addApplicant(
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
  return db.applicant.create({
    data: {
      orgId: ctx.orgId,
      jobOpeningId: input.jobOpeningId,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  })
}

export async function hireApplicant(ctx: OrgContext, applicantId: string) {
  assertPermission(ctx, 'hr:update')
  const applicant = await db.applicant.findFirst({
    where: { id: applicantId, orgId: ctx.orgId },
    include: { jobOpening: true },
  })
  if (!applicant) throw notFound('Applicant')

  const employee = await employeeService.create(
    ctx,
    employeeCreateSchema.parse({
      name: applicant.name,
      workEmail: applicant.email ?? null,
      workPhone: applicant.phone ?? null,
      jobTitle: applicant.jobOpening.title,
      department: applicant.jobOpening.department ?? null,
      active: true,
    }),
  )

  await db.$transaction([
    db.applicant.update({
      where: { id: applicant.id },
      data: { status: 'HIRED', employeeId: employee.id },
    }),
    db.jobOpening.update({
      where: { id: applicant.jobOpeningId },
      data: { status: 'FILLED' },
    }),
  ])

  return { employeeId: employee.id }
}
