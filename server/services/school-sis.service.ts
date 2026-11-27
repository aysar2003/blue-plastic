import 'server-only'

import { canPromoteEnrollment } from '@/lib/erp/academic-year-lifecycle'
import { addDays, toCalendarDate, toDate as toJsDate, today } from '@/lib/date'
import { Decimal } from '@/lib/money'
import { sendTextNotification } from '@/lib/notify-gateway'
import {
  assertScoreInRange,
  attendanceSummary,
  isAttendanceMark,
  letterFromPercent,
  letterFromPercentHorn,
  rankStudents,
  weightedGradePercent,
  type AttendanceMark,
} from '@/lib/erp/school-sis'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'

async function notifyPhone(phone: string | null | undefined, text: string) {
  if (!phone?.trim()) return { ok: false as const, reason: 'no_phone' as const }
  const wa = await sendTextNotification('whatsapp', phone, text)
  if (wa.ok) return wa
  return sendTextNotification('sms', phone, text)
}

function guardianPhoneOf(row: {
  guardianPhone?: string | null
  customer?: { phone?: string | null; mobile?: string | null } | null
  billingCustomer?: { phone?: string | null; mobile?: string | null } | null
}): string | null {
  return (
    row.guardianPhone?.trim() ||
    row.billingCustomer?.mobile?.trim() ||
    row.billingCustomer?.phone?.trim() ||
    row.customer?.mobile?.trim() ||
    row.customer?.phone?.trim() ||
    null
  )
}

async function assertEmployeeTeacher(ctx: OrgContext, employeeId: string | null | undefined) {
  if (!employeeId) return null
  const employee = await db.employee.findFirst({
    where: { id: employeeId, orgId: ctx.orgId, active: true },
    select: { id: true, name: true },
  })
  if (!employee) throw notFound('Teacher employee')
  return employee
}

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
      teacherEmployee: { select: { id: true, name: true } },
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
      teacherEmployee: { select: { id: true, name: true } },
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
      gradeItems: { include: { subject: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
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
    teacherEmployeeId?: string | null
    campusId?: string | null
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
  const teacher = await assertEmployeeTeacher(ctx, input.teacherEmployeeId)
  let campusId: string | null = null
  if (input.campusId) {
    const campus = await db.schoolCampus.findFirst({
      where: { id: input.campusId, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!campus) throw notFound('Campus')
    campusId = campus.id
  }

  const data = {
    name,
    code: input.code?.trim() || null,
    teacherName: input.teacherName?.trim() || teacher?.name || null,
    teacherEmployeeId: teacher?.id ?? null,
    campusId,
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

  const onDate = toJsDate(input.onDate.slice(0, 10))
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
  const date = toJsDate(onDate.slice(0, 10))
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

export async function attendanceRegister(
  ctx: OrgContext,
  classId: string,
  fromDate: string,
  toDate: string,
) {
  const from = fromDate.slice(0, 10)
  const to = toDate.slice(0, 10)
  if (from > to) throw validation('Start date must be on or before the end date.')

  const schoolClass = await getClass(ctx, classId)
  const dates: string[] = []
  let cursor = from
  while (cursor <= to) {
    dates.push(cursor)
    cursor = addDays(cursor, 1)
    if (dates.length > 366) throw validation('Attendance register range cannot exceed 366 days.')
  }

  const rows = await db.studentAttendanceDay.findMany({
    where: {
      orgId: ctx.orgId,
      classId,
      onDate: { gte: toJsDate(from), lte: toJsDate(to) },
    },
  })
  const byKey = new Map(rows.map((row) => [`${row.enrollmentId}:${toCalendarDate(row.onDate)}`, row]))

  return {
    schoolClass,
    fromDate: from,
    toDate: to,
    dates,
    rows: schoolClass.members.map((member) => {
      const marks = dates.map((date) => {
        const hit = byKey.get(`${member.enrollmentId}:${date}`)
        return {
          onDate: date,
          mark: (hit?.mark ?? null) as AttendanceMark | null,
          note: hit?.note ?? '',
        }
      })
      const summary = attendanceSummary(
        marks.map((row) => row.mark).filter((mark): mark is AttendanceMark => mark != null),
      )
      return {
        enrollmentId: member.enrollmentId,
        studentName: member.enrollment.customer.displayName,
        marks,
        summary,
      }
    }),
  }
}

export async function notifyAbsences(ctx: OrgContext, classId: string, onDate: string) {
  const schoolClass = await db.schoolClass.findFirst({
    where: { id: classId, orgId: ctx.orgId },
    select: { id: true, name: true },
  })
  if (!schoolClass) throw notFound('Class')
  const date = onDate.slice(0, 10)
  const absences = await db.studentAttendanceDay.findMany({
    where: { orgId: ctx.orgId, classId, onDate: toJsDate(date), mark: 'ABSENT' },
    include: {
      enrollment: {
        select: {
          guardianPhone: true,
          guardianName: true,
          customer: { select: { displayName: true, phone: true, mobile: true } },
          billingCustomer: { select: { phone: true, mobile: true } },
        },
      },
    },
  })

  let sent = 0
  let skipped = 0
  for (const row of absences) {
    const phone = guardianPhoneOf(row.enrollment)
    const studentName = row.enrollment.customer.displayName
    const text = `${ctx.organization.name}: ${studentName} was marked absent in ${schoolClass.name} on ${date}.`
    const result = await notifyPhone(phone, text)
    if (result.ok) sent += 1
    else skipped += 1
  }

  return { classId, onDate: date, absences: absences.length, sent, skipped }
}

export async function upsertGradeItem(
  ctx: OrgContext,
  input: {
    id?: string
    classId: string
    subjectId?: string | null
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
  if (input.subjectId) {
    const subject = await db.schoolSubject.findFirst({
      where: { id: input.subjectId, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!subject) throw notFound('Subject')
  }

  const data = {
    name,
    subjectId: input.subjectId || null,
    maxScore: new Decimal(maxScore),
    weightPercent: new Decimal(weightPercent),
    dueOn: input.dueOn ? toJsDate(input.dueOn.slice(0, 10)) : null,
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
    include: { entries: true, subject: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const students = schoolClass.members.map((member) => {
    const enrollmentId = member.enrollmentId
    const scores = items.map((item) => {
      const entry = item.entries.find((e) => e.enrollmentId === enrollmentId)
      return {
        gradeItemId: item.id,
        name: item.name,
        subjectId: item.subjectId,
        subjectName: item.subject?.name ?? null,
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
          schoolClass: {
            select: {
              id: true,
              name: true,
              teacherName: true,
              teacherEmployeeId: true,
              members: { select: { enrollmentId: true } },
            },
          },
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
        entries: true,
        schoolClass: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.studentAttendanceDay.findMany({
      where: { orgId: ctx.orgId, enrollmentId },
      orderBy: { onDate: 'asc' },
    }),
  ])

  type GradeRow = {
    name: string
    score: number
    maxScore: number
    weightPercent: number
    subjectId: string | null
    subjectName: string
  }

  const byClass = new Map<
    string,
    {
      classId: string
      className: string
      teacherName: string | null
      teacherEmployeeId: string | null
      classSize: number
      memberIds: string[]
      rowsByEnrollment: Map<string, GradeRow[]>
    }
  >()

  for (const member of enrollment.classMembers) {
    byClass.set(member.classId, {
      classId: member.classId,
      className: member.schoolClass.name,
      teacherName: member.schoolClass.teacherName,
      teacherEmployeeId: member.schoolClass.teacherEmployeeId,
      classSize: member.schoolClass.members.length,
      memberIds: member.schoolClass.members.map((m) => m.enrollmentId),
      rowsByEnrollment: new Map(),
    })
  }

  for (const item of items) {
    const bucket = byClass.get(item.classId)
    if (!bucket) continue
    for (const entry of item.entries) {
      const list = bucket.rowsByEnrollment.get(entry.enrollmentId) ?? []
      list.push({
        name: item.name,
        score: Number(entry.score),
        maxScore: Number(item.maxScore),
        weightPercent: Number(item.weightPercent),
        subjectId: item.subjectId,
        subjectName: item.subject?.name ?? 'General',
      })
      bucket.rowsByEnrollment.set(entry.enrollmentId, list)
    }
  }

  const classes = [...byClass.values()].map((block) => {
    const percents = block.memberIds.map((id) => weightedGradePercent(block.rowsByEnrollment.get(id) ?? []))
    const ranks = rankStudents(percents)
    const selfIndex = block.memberIds.indexOf(enrollmentId)
    const selfRows = block.rowsByEnrollment.get(enrollmentId) ?? []
    const bySubject = new Map<string, { subjectId: string | null; subjectName: string; rows: GradeRow[] }>()
    for (const row of selfRows) {
      const key = row.subjectId ?? '__general'
      const group = bySubject.get(key) ?? {
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        rows: [],
      }
      group.rows.push(row)
      bySubject.set(key, group)
    }
    const subjects = [...bySubject.values()].map((group) => {
      const averagePercent = weightedGradePercent(group.rows)
      return {
        ...group,
        averagePercent,
        letter: letterFromPercentHorn(averagePercent),
      }
    })
    const averagePercent = weightedGradePercent(selfRows)
    return {
      classId: block.classId,
      className: block.className,
      teacherName: block.teacherName,
      teacherEmployeeId: block.teacherEmployeeId,
      subjects,
      rows: selfRows,
      averagePercent,
      letter: letterFromPercentHorn(averagePercent),
      classRank: selfIndex >= 0 ? ranks[selfIndex] ?? null : null,
      classSize: block.classSize,
    }
  })

  const att = attendanceSummary(attendance.map((row) => row.mark as AttendanceMark))

  return {
    enrollment: {
      id: enrollment.id,
      status: enrollment.status,
      studentName: enrollment.customer.displayName,
      customerId: enrollment.customer.id,
      admissionNumber: enrollment.admissionNumber,
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

export async function promoteEnrollment(
  ctx: OrgContext,
  input: {
    enrollmentId: string
    termId: string
    programId?: string | null
    feePlanId?: string | null
  },
) {
  const source = await db.studentEnrollment.findFirst({
    where: { id: input.enrollmentId, orgId: ctx.orgId },
  })
  if (!source) throw notFound('Enrollment')
  if (!canPromoteEnrollment(source.status)) {
    throw precondition('Only an enrolled or completed student can be promoted.')
  }

  const term = await db.academicTerm.findFirst({
    where: { id: input.termId, orgId: ctx.orgId, isActive: true },
    select: { id: true },
  })
  if (!term) throw notFound('Term')

  const programId = input.programId || source.programId
  const program = await db.academicProgram.findFirst({
    where: { id: programId, orgId: ctx.orgId, isActive: true },
    select: { id: true },
  })
  if (!program) throw notFound('Program')

  const feePlanId = input.feePlanId === undefined ? source.feePlanId : input.feePlanId
  if (feePlanId) {
    const plan = await db.feePlan.findFirst({
      where: { id: feePlanId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!plan) throw notFound('Fee plan')
  }

  const exists = await db.studentEnrollment.findFirst({
    where: {
      orgId: ctx.orgId,
      customerId: source.customerId,
      programId,
      termId: term.id,
    },
    select: { id: true },
  })
  if (exists) throw conflict('This student is already enrolled in that program for the term.')

  if (source.status === 'ENROLLED') {
    await db.studentEnrollment.update({
      where: { id: source.id },
      data: { status: 'COMPLETED' },
    })
  }

  const created = await db.studentEnrollment.create({
    data: {
      orgId: ctx.orgId,
      customerId: source.customerId,
      billingCustomerId: source.billingCustomerId,
      programId,
      termId: term.id,
      feePlanId,
      campusId: source.campusId,
      scholarshipPercent: source.scholarshipPercent,
      dateOfBirth: source.dateOfBirth,
      gender: source.gender,
      guardianName: source.guardianName,
      guardianPhone: source.guardianPhone,
      photoUrl: source.photoUrl,
      notes: source.notes,
      status: 'ENROLLED',
    },
  })

  return { fromEnrollmentId: source.id, enrollmentId: created.id }
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
