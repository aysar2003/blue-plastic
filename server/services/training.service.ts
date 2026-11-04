import 'server-only'

import { Decimal } from '@/lib/money'
import { canCompleteTraining, canFailTraining, type TrainingStatus } from '@/lib/erp/training'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'

export async function listBoard(ctx: OrgContext) {
  assertPermission(ctx, 'hr:read')
  const [courses, enrollments, employees] = await Promise.all([
    db.trainingCourse.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { title: 'asc' },
      take: 80,
    }),
    db.trainingEnrollment.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { title: true } },
        employee: { select: { name: true } },
      },
      take: 80,
    }),
    db.employee.findMany({
      where: { orgId: ctx.orgId, lifecycleStatus: { not: 'LEFT' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ])
  return {
    courses: courses.map((row) => ({ ...row, hours: row.hours.toString() })),
    enrollments,
    employees,
  }
}

export async function createCourse(
  ctx: OrgContext,
  input: { title: string; hours?: string; description?: string | null },
) {
  assertPermission(ctx, 'hr:update')
  const title = input.title.trim()
  if (!title) throw validation('Name the course.')
  return db.trainingCourse.create({
    data: {
      orgId: ctx.orgId,
      title,
      hours: new Decimal(input.hours || '0').toFixed(4),
      description: input.description?.trim() || null,
    },
    select: { id: true },
  })
}

export async function enroll(
  ctx: OrgContext,
  input: { courseId: string; employeeId: string },
) {
  assertPermission(ctx, 'hr:update')
  const course = await db.trainingCourse.findFirst({
    where: { id: input.courseId, orgId: ctx.orgId, active: true },
    select: { id: true },
  })
  if (!course) throw notFound('Course')
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!employee) throw notFound('Employee')
  return db.trainingEnrollment.create({
    data: { orgId: ctx.orgId, courseId: course.id, employeeId: employee.id },
    select: { id: true },
  })
}

export async function completeEnrollment(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'hr:update')
  const row = await db.trainingEnrollment.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Enrollment')
  if (!canCompleteTraining(row.status as TrainingStatus)) {
    throw precondition('Only an enrolled person can complete.')
  }
  return db.trainingEnrollment.update({
    where: { id: row.id },
    data: { status: 'COMPLETED', completedAt: new Date() },
    select: { id: true },
  })
}

export async function failEnrollment(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'hr:update')
  const row = await db.trainingEnrollment.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Enrollment')
  if (!canFailTraining(row.status as TrainingStatus)) {
    throw precondition('Only an enrolled person can fail.')
  }
  return db.trainingEnrollment.update({
    where: { id: row.id },
    data: { status: 'FAILED' },
    select: { id: true },
  })
}
