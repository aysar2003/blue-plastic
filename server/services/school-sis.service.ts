import 'server-only'

import { Decimal } from '@/lib/money'
import { toDate, today } from '@/lib/date'
import {
  assertScoreInRange,
  attendanceSummary,
  isAttendanceMark,
  letterFromPercent,
  weightedGradePercent,
  type AttendanceMark,
} from '@/lib/erp/school-sis'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'

export async function listClasses(ctx: OrgContext, termId?: string) {
  return db.schoolClass.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      ...(termId ? { termId } : {}),
    },
    include: {
      program: { select: { id: true, name: true } },
      term: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
    orderBy: [{ term: { startsOn: 'desc' } }, { name: 'asc' }],
  })
}

export async function getClass(ctx: OrgContext, classId: string) {
  const row = await db.schoolClass.findFirst({
    where: { id: classId, orgId: ctx.orgId },
    include: {
      program: { select: { id: true, name: true } },
      term: { select: { id: true, name: true, startsOn: true, endsOn: true } },
      members: {
        include: {
          enrollment: {
            include: {
              customer: { select: { id: true, displayName: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      gradeItems: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!row) throw notFound('Class')
  return row
}

export async function upsertClass(
  ctx: OrgContext,
  input: {
    id?: string
    name: string
    code?: string | null
    teacherName?: string | null
    programId: string
    termId: string
  },
) {
  const name = input.name.trim()
  if (!name) throw validation('Class name is required.')
  const program = await db.academicProgram.findFirst({
    where: { id: input.programId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!program) throw notFound('Program')
  const term = await db.academicTerm.findFirst({
    where: { id: input.termId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!term) throw notFound('Term')

  const data = {
    name,
    code: input.code?.trim() || null,
    teacherName: input.teacherName?.trim() || null,
    programId: input.programId,
    termId: input.termId,
  }

  if (input.id) {
    const existing = await db.schoolClass.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Class')
    try {
      return await db.schoolClass.update({ where: { id: input.id }, data })
    } catch {
      throw conflict('Another class already uses that name in this term.')
    }
  }

  try {
    return await db.schoolClass.create({
      data: { orgId: ctx.orgId, ...data },
    })
  } catch {
    throw conflict('Another class already uses that name in this term.')
  }
}

export async function addClassMember(ctx: OrgContext, classId: string, enrollmentId: string) {
  const schoolClass = await db.schoolClass.findFirst({
    where: { id: classId, orgId: ctx.orgId, isActive: true },
    select: { id: true, programId: true, termId: true },
  })
  if (!schoolClass) throw notFound('Class')

  const enrollment = await db.studentEnrollment.findFirst({
    where: { id: enrollmentId, orgId: ctx.orgId, status: 'ENROLLED' },
    select: { id: true, programId: true, termId: true },
  })
  if (!enrollment) throw notFound('Enrollment')
  if (enrollment.programId !== schoolClass.programId || enrollment.termId !== schoolClass.termId) {
    throw precondition('Enrollment must match the class program and term.')
  }

  try {
    return await db.schoolClassMember.create({
      data: { orgId: ctx.orgId, classId, enrollmentId },
    })
  } catch {
    throw conflict('Student is already on this class roster.')
  }
}

export async function removeClassMember(ctx: OrgContext, memberId: string) {
  const member = await db.schoolClassMember.findFirst({
    where: { id: memberId, orgId: ctx.orgId },
    select: { id: true, classId: true },
  })
  if (!member) throw notFound('Class member')
  await db.schoolClassMember.delete({ where: { id: member.id } })
  return member
}

export async function saveAttendanceDay(
  ctx: OrgContext,
  input: {
    classId: string
    onDate: string
    rows: { enrollmentId: string; mark: string; note?: string }[]
  },
) {
  const schoolClass = await db.schoolClass.findFirst({
    where: { id: input.classId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!schoolClass) throw notFound('Class')

  const onDate = toDate(input.onDate.slice(0, 10))
  const members = await db.schoolClassMember.findMany({
    where: { classId: input.classId, orgId: ctx.orgId },
    select: { enrollmentId: true },
  })
  const allowed = new Set(members.map((m) => m.enrollmentId))

  for (const row of input.rows) {
    if (!allowed.has(row.enrollmentId)) continue
    if (!isAttendanceMark(row.mark)) throw validation(`Invalid attendance mark: ${row.mark}`)
    await db.studentAttendanceDay.upsert({
      where: {
        classId_enrollmentId_onDate: {
          classId: input.classId,
          enrollmentId: row.enrollmentId,
          onDate,
        },
      },
      create: {
        orgId: ctx.orgId,
        classId: input.classId,
        enrollmentId: row.enrollmentId,
        onDate,
        mark: row.mark,
        note: row.note?.trim() || null,
      },
      update: {
        mark: row.mark,
        note: row.note?.trim() || null,
      },
    })
  }

  return { classId: input.classId, onDate: input.onDate.slice(0, 10), saved: input.rows.length }
}

export async function listAttendanceForClass(
  ctx: OrgContext,
  classId: string,
  onDate: string,
) {
  const schoolClass = await getClass(ctx, classId)
  const date = toDate(onDate.slice(0, 10))
  const existing = await db.studentAttendanceDay.findMany({
    where: { orgId: ctx.orgId, classId, onDate: date },
  })
  const byEnrollment = new Map(existing.map((row) => [row.enrollmentId, row]))
  return {
    schoolClass,
    onDate: onDate.slice(0, 10),
    rows: schoolClass.members.map((member) => ({
      enrollmentId: member.enrollmentId,
      studentName: member.enrollment.customer.displayName,
      mark: (byEnrollment.get(member.enrollmentId)?.mark ?? 'PRESENT') as AttendanceMark,
      note: byEnrollment.get(member.enrollmentId)?.note ?? '',
    })),
  }
}

export async function upsertGradeItem(
  ctx: OrgContext,
  input: {
    id?: string
    classId: string
    name: string
    maxScore: string
    weightPercent?: string
    dueOn?: string | null
  },
) {
  const name = input.name.trim()
  if (!name) throw validation('Assessment name is required.')
  const maxScore = Number(input.maxScore)
  if (!Number.isFinite(maxScore) || maxScore <= 0) throw validation('Max score must be greater than zero.')
  const weightPercent = Number(input.weightPercent ?? '100')
  if (!Number.isFinite(weightPercent) || weightPercent <= 0) {
    throw validation('Weight percent must be greater than zero.')
  }

  const schoolClass = await db.schoolClass.findFirst({
    where: { id: input.classId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!schoolClass) throw notFound('Class')

  const data = {
    name,
    maxScore: new Decimal(maxScore),
    weightPercent: new Decimal(weightPercent),
    dueOn: input.dueOn ? toDate(input.dueOn.slice(0, 10)) : null,
  }

  if (input.id) {
    const existing = await db.gradeItem.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Grade item')
    try {
      return await db.gradeItem.update({ where: { id: input.id }, data })
    } catch {
      throw conflict('Another assessment already uses that name in this class.')
    }
  }

  try {
    return await db.gradeItem.create({
      data: { orgId: ctx.orgId, classId: input.classId, ...data },
    })
  } catch {
    throw conflict('Another assessment already uses that name in this class.')
  }
}

export async function saveGradeScores(
  ctx: OrgContext,
  input: {
    gradeItemId: string
    rows: { enrollmentId: string; score: string; comment?: string }[]
  },
) {
  const item = await db.gradeItem.findFirst({
    where: { id: input.gradeItemId, orgId: ctx.orgId },
    include: {
      schoolClass: {
        include: { members: { select: { enrollmentId: true } } },
      },
    },
  })
  if (!item) throw notFound('Grade item')
  const allowed = new Set(item.schoolClass.members.map((m) => m.enrollmentId))
  const maxScore = Number(item.maxScore)

  for (const row of input.rows) {
    if (!allowed.has(row.enrollmentId)) continue
    const score = Number(row.score)
    const err = assertScoreInRange(score, maxScore)
    if (err) throw validation(err)
    await db.gradeEntry.upsert({
      where: {
        gradeItemId_enrollmentId: {
          gradeItemId: item.id,
          enrollmentId: row.enrollmentId,
        },
      },
      create: {
        orgId: ctx.orgId,
        gradeItemId: item.id,
        enrollmentId: row.enrollmentId,
        score: new Decimal(score),
        comment: row.comment?.trim() || null,
      },
      update: {
        score: new Decimal(score),
        comment: row.comment?.trim() || null,
      },
    })
  }

  return { gradeItemId: item.id, saved: input.rows.length }
}

export async function classGradebook(ctx: OrgContext, classId: string) {
  const schoolClass = await getClass(ctx, classId)
  const items = await db.gradeItem.findMany({
    where: { orgId: ctx.orgId, classId },
    include: { entries: true },
    orderBy: { createdAt: 'asc' },
  })

  const students = schoolClass.members.map((member) => {
    const enrollmentId = member.enrollmentId
    const scores = items.map((item) => {
      const entry = item.entries.find((e) => e.enrollmentId === enrollmentId)
      return {
        gradeItemId: item.id,
        name: item.name,
        score: entry ? Number(entry.score) : null,
        maxScore: Number(item.maxScore),
        weightPercent: Number(item.weightPercent),
      }
    })
    const weighted = weightedGradePercent(
      scores
        .filter((s) => s.score != null)
        .map((s) => ({
          score: s.score as number,
          maxScore: s.maxScore,
          weightPercent: s.weightPercent,
        })),
    )
    return {
      enrollmentId,
      studentName: member.enrollment.customer.displayName,
      customerId: member.enrollment.customer.id,
      scores,
      averagePercent: weighted,
      letter: letterFromPercent(weighted),
    }
  })

  return { schoolClass, items, students }
}

export async function studentReportCard(ctx: OrgContext, enrollmentId: string) {
  const enrollment = await db.studentEnrollment.findFirst({
    where: { id: enrollmentId, orgId: ctx.orgId },
    include: {
      customer: { select: { id: true, displayName: true } },
      program: { select: { id: true, name: true } },
      term: { select: { id: true, name: true } },
      classMembers: {
        include: {
          schoolClass: { select: { id: true, name: true, teacherName: true } },
        },
      },
    },
  })
  if (!enrollment) throw notFound('Enrollment')

  const classIds = enrollment.classMembers.map((m) => m.classId)
  const [items, attendance] = await Promise.all([
    db.gradeItem.findMany({
      where: { orgId: ctx.orgId, classId: { in: classIds } },
      include: {
        entries: { where: { enrollmentId } },
        schoolClass: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.studentAttendanceDay.findMany({
      where: { orgId: ctx.orgId, enrollmentId },
      orderBy: { onDate: 'asc' },
    }),
  ])

  const byClass = new Map<
    string,
    {
      classId: string
      className: string
      teacherName: string | null
      rows: { name: string; score: number; maxScore: number; weightPercent: number }[]
    }
  >()

  for (const member of enrollment.classMembers) {
    byClass.set(member.classId, {
      classId: member.classId,
      className: member.schoolClass.name,
      teacherName: member.schoolClass.teacherName,
      rows: [],
    })
  }

  for (const item of items) {
    const entry = item.entries[0]
    if (!entry) continue
    const bucket = byClass.get(item.classId)
    if (!bucket) continue
    bucket.rows.push({
      name: item.name,
      score: Number(entry.score),
      maxScore: Number(item.maxScore),
      weightPercent: Number(item.weightPercent),
    })
  }

  const classes = [...byClass.values()].map((block) => {
    const averagePercent = weightedGradePercent(block.rows)
    return {
      ...block,
      averagePercent,
      letter: letterFromPercent(averagePercent),
    }
  })

  const att = attendanceSummary(attendance.map((row) => row.mark as AttendanceMark))

  return {
    enrollment: {
      id: enrollment.id,
      status: enrollment.status,
      studentName: enrollment.customer.displayName,
      customerId: enrollment.customer.id,
      programName: enrollment.program.name,
      termName: enrollment.term.name,
    },
    classes,
    attendance: att,
  }
}

/** Portal: report cards for enrollments belonging to this customer. */
export async function portalReportCardsForCustomer(ctx: OrgContext, customerId: string) {
  const enrollments = await db.studentEnrollment.findMany({
    where: { orgId: ctx.orgId, customerId },
    select: { id: true },
    orderBy: { enrolledAt: 'desc' },
  })
  const cards = []
  for (const row of enrollments) {
    cards.push(await studentReportCard(ctx, row.id))
  }
  return cards
}

export async function enrollmentsEligibleForClass(ctx: OrgContext, classId: string) {
  const schoolClass = await db.schoolClass.findFirst({
    where: { id: classId, orgId: ctx.orgId },
    select: { programId: true, termId: true, members: { select: { enrollmentId: true } } },
  })
  if (!schoolClass) throw notFound('Class')
  const taken = new Set(schoolClass.members.map((m) => m.enrollmentId))
  const rows = await db.studentEnrollment.findMany({
    where: {
      orgId: ctx.orgId,
      status: 'ENROLLED',
      programId: schoolClass.programId,
      termId: schoolClass.termId,
    },
    include: { customer: { select: { displayName: true } } },
    orderBy: { enrolledAt: 'desc' },
  })
  return rows
    .filter((row) => !taken.has(row.id))
    .map((row) => ({
      id: row.id,
      label: row.customer.displayName,
    }))
}

export function defaultAttendanceDate() {
  return today()
}
