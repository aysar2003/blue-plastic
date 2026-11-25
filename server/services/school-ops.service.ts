import 'server-only'

import { Decimal } from '@/lib/money'
import { toDate, today } from '@/lib/date'
import { sendTextNotification } from '@/lib/notify-gateway'
import {
  assertDayOfWeek,
  assertPeriodIndex,
  assertTimeOrder,
  hostelRoomFull,
  isAssignmentStatus,
  isDisciplineSeverity,
  isSchoolAudience,
  slotsOverlap,
} from '@/lib/erp/school-ops'
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

async function requireCampus(ctx: OrgContext, campusId: string | null | undefined) {
  if (!campusId) return null
  const campus = await db.schoolCampus.findFirst({
    where: { id: campusId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!campus) throw notFound('Campus')
  return campus
}

async function requireFeeItem(ctx: OrgContext, itemId: string | null | undefined) {
  if (!itemId) return null
  const item = await db.item.findFirst({
    where: { id: itemId, orgId: ctx.orgId, isActive: true, deletedAt: null },
    select: { id: true },
  })
  if (!item) throw notFound('Fee item')
  return item
}

export async function listCampuses(ctx: OrgContext, opts?: { includeInactive?: boolean }) {
  return db.schoolCampus.findMany({
    where: {
      orgId: ctx.orgId,
      ...(opts?.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { name: 'asc' },
  })
}

export async function upsertCampus(
  ctx: OrgContext,
  input: { id?: string; name: string; isActive?: boolean },
) {
  const name = input.name.trim()
  if (!name) throw validation('Campus name is required.')
  if (input.id) {
    const existing = await db.schoolCampus.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Campus')
    try {
      return await db.schoolCampus.update({
        where: { id: input.id },
        data: { name, isActive: input.isActive ?? true },
      })
    } catch {
      throw conflict('Another campus already uses that name.')
    }
  }
  try {
    return await db.schoolCampus.create({
      data: { orgId: ctx.orgId, name, isActive: input.isActive ?? true },
    })
  } catch {
    throw conflict('Another campus already uses that name.')
  }
}

export async function listSubjects(ctx: OrgContext) {
  return db.schoolSubject.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    orderBy: { name: 'asc' },
  })
}

export async function upsertSubject(
  ctx: OrgContext,
  input: { id?: string; name: string; code?: string | null },
) {
  const name = input.name.trim()
  if (!name) throw validation('Subject name is required.')
  if (input.id) {
    return db.schoolSubject.update({
      where: { id: input.id },
      data: { name, code: input.code?.trim() || null },
    })
  }
  try {
    return await db.schoolSubject.create({
      data: { orgId: ctx.orgId, name, code: input.code?.trim() || null },
    })
  } catch {
    throw conflict('Another subject already uses that name.')
  }
}

export async function linkClassSubject(
  ctx: OrgContext,
  input: {
    classId: string
    subjectId: string
    teacherName?: string | null
    teacherEmployeeId?: string | null
  },
) {
  const schoolClass = await db.schoolClass.findFirst({
    where: { id: input.classId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!schoolClass) throw notFound('Class')
  const subject = await db.schoolSubject.findFirst({
    where: { id: input.subjectId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!subject) throw notFound('Subject')
  const teacher = await assertEmployeeTeacher(ctx, input.teacherEmployeeId)
  try {
    return await db.schoolClassSubject.create({
      data: {
        orgId: ctx.orgId,
        classId: input.classId,
        subjectId: input.subjectId,
        teacherName: input.teacherName?.trim() || teacher?.name || null,
        teacherEmployeeId: teacher?.id ?? null,
      },
    })
  } catch {
    throw conflict('Subject is already linked to this class.')
  }
}

export async function listTimetable(ctx: OrgContext, classId: string) {
  const schoolClass = await db.schoolClass.findFirst({
    where: { id: classId, orgId: ctx.orgId },
    select: { id: true, name: true },
  })
  if (!schoolClass) throw notFound('Class')
  const slots = await db.timetableSlot.findMany({
    where: { orgId: ctx.orgId, classId },
    include: { subject: { select: { id: true, name: true, code: true } } },
    orderBy: [{ dayOfWeek: 'asc' }, { periodIndex: 'asc' }],
  })
  return { schoolClass, slots }
}

export async function upsertTimetableSlot(
  ctx: OrgContext,
  input: {
    id?: string
    classId: string
    subjectId?: string | null
    teacherEmployeeId?: string | null
    dayOfWeek: number
    periodIndex: number
    startsAt: string
    endsAt: string
    room?: string | null
  },
) {
  const dayErr = assertDayOfWeek(input.dayOfWeek)
  if (dayErr) throw validation(dayErr)
  const periodErr = assertPeriodIndex(input.periodIndex)
  if (periodErr) throw validation(periodErr)
  const timeErr = assertTimeOrder(input.startsAt.trim(), input.endsAt.trim())
  if (timeErr) throw validation(timeErr)

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
  const teacher = await assertEmployeeTeacher(ctx, input.teacherEmployeeId)
  const startsAt = input.startsAt.trim()
  const endsAt = input.endsAt.trim()
  const room = input.room?.trim() || null

  const clashFilters = [
    ...(teacher ? [{ teacherEmployeeId: teacher.id }] : []),
    ...(room ? [{ room }] : []),
  ]
  if (clashFilters.length > 0) {
    const candidates = await db.timetableSlot.findMany({
      where: {
        orgId: ctx.orgId,
        dayOfWeek: input.dayOfWeek,
        ...(input.id ? { id: { not: input.id } } : {}),
        OR: clashFilters,
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        teacherEmployeeId: true,
        room: true,
      },
    })
    for (const other of candidates) {
      if (!slotsOverlap({ startsAt, endsAt }, other)) continue
      if (teacher && other.teacherEmployeeId === teacher.id) {
        throw conflict('Teacher is already scheduled in overlapping period.')
      }
      if (room && other.room === room) {
        throw conflict('Room is already booked in overlapping period.')
      }
    }
  }

  const data = {
    classId: input.classId,
    subjectId: input.subjectId || null,
    teacherEmployeeId: teacher?.id ?? null,
    dayOfWeek: input.dayOfWeek,
    periodIndex: input.periodIndex,
    startsAt,
    endsAt,
    room,
  }

  if (input.id) {
    const existing = await db.timetableSlot.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Timetable slot')
    try {
      return await db.timetableSlot.update({ where: { id: input.id }, data })
    } catch {
      throw conflict('That period is already used on this day for the class.')
    }
  }

  try {
    return await db.timetableSlot.create({ data: { orgId: ctx.orgId, ...data } })
  } catch {
    throw conflict('That period is already used on this day for the class.')
  }
}

export async function listExams(ctx: OrgContext, opts?: { classId?: string; termId?: string }) {
  return db.schoolExam.findMany({
    where: {
      orgId: ctx.orgId,
      ...(opts?.classId ? { classId: opts.classId } : {}),
      ...(opts?.termId ? { termId: opts.termId } : {}),
    },
    include: {
      schoolClass: { select: { id: true, name: true } },
      term: { select: { id: true, name: true } },
      _count: { select: { slots: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getExam(ctx: OrgContext, examId: string) {
  const exam = await db.schoolExam.findFirst({
    where: { id: examId, orgId: ctx.orgId },
    include: {
      schoolClass: { select: { id: true, name: true } },
      term: { select: { id: true, name: true } },
      slots: {
        include: { subject: { select: { id: true, name: true, code: true } } },
        orderBy: [{ onDate: 'asc' }, { startsAt: 'asc' }],
      },
    },
  })
  if (!exam) throw notFound('Exam')
  return exam
}

export async function upsertExam(
  ctx: OrgContext,
  input: { id?: string; termId: string; classId: string; title: string },
) {
  const title = input.title.trim()
  if (!title) throw validation('Exam title is required.')
  const schoolClass = await db.schoolClass.findFirst({
    where: { id: input.classId, orgId: ctx.orgId },
    select: { id: true, termId: true },
  })
  if (!schoolClass) throw notFound('Class')
  const term = await db.academicTerm.findFirst({
    where: { id: input.termId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!term) throw notFound('Term')

  const data = { termId: input.termId, classId: input.classId, title }

  if (input.id) {
    const existing = await db.schoolExam.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Exam')
    return db.schoolExam.update({ where: { id: input.id }, data })
  }

  return db.schoolExam.create({ data: { orgId: ctx.orgId, ...data } })
}

export async function upsertExamSlot(
  ctx: OrgContext,
  input: {
    id?: string
    examId: string
    classId?: string | null
    subjectId?: string | null
    onDate: string
    startsAt: string
    endsAt: string
    room?: string | null
    invigilatorName?: string | null
  },
) {
  const timeErr = assertTimeOrder(input.startsAt.trim(), input.endsAt.trim())
  if (timeErr) throw validation(timeErr)
  const exam = await db.schoolExam.findFirst({
    where: { id: input.examId, orgId: ctx.orgId },
    select: { id: true, classId: true },
  })
  if (!exam) throw notFound('Exam')
  const classId = input.classId || exam.classId
  const schoolClass = await db.schoolClass.findFirst({
    where: { id: classId, orgId: ctx.orgId },
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
    examId: exam.id,
    classId,
    subjectId: input.subjectId || null,
    onDate: toDate(input.onDate.slice(0, 10)),
    startsAt: input.startsAt.trim(),
    endsAt: input.endsAt.trim(),
    room: input.room?.trim() || null,
    invigilatorName: input.invigilatorName?.trim() || null,
  }

  if (input.id) {
    const existing = await db.schoolExamSlot.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Exam slot')
    return db.schoolExamSlot.update({ where: { id: input.id }, data })
  }

  return db.schoolExamSlot.create({ data: { orgId: ctx.orgId, ...data } })
}

export async function createAssignment(
  ctx: OrgContext,
  input: {
    classId: string
    subjectId?: string | null
    title: string
    body?: string | null
    dueOn?: string | null
    maxScore?: string
  },
) {
  const title = input.title.trim()
  if (!title) throw validation('Assignment title is required.')
  const schoolClass = await db.schoolClass.findFirst({
    where: { id: input.classId, orgId: ctx.orgId },
    include: { members: { select: { enrollmentId: true } } },
  })
  if (!schoolClass) throw notFound('Class')

  const maxScore = Number(input.maxScore ?? '100')
  if (!Number.isFinite(maxScore) || maxScore <= 0) throw validation('Max score must be greater than zero.')

  const assignment = await db.schoolAssignment.create({
    data: {
      orgId: ctx.orgId,
      classId: input.classId,
      subjectId: input.subjectId || null,
      title,
      body: input.body?.trim() || null,
      dueOn: input.dueOn ? toDate(input.dueOn.slice(0, 10)) : null,
      maxScore: new Decimal(maxScore),
    },
  })

  if (schoolClass.members.length) {
    await db.assignmentSubmission.createMany({
      data: schoolClass.members.map((member) => ({
        orgId: ctx.orgId,
        assignmentId: assignment.id,
        enrollmentId: member.enrollmentId,
        status: 'ASSIGNED' as const,
      })),
      skipDuplicates: true,
    })
  }

  return assignment
}

export async function listAssignments(ctx: OrgContext, classId?: string) {
  return db.schoolAssignment.findMany({
    where: { orgId: ctx.orgId, ...(classId ? { classId } : {}) },
    include: {
      schoolClass: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: [{ dueOn: 'asc' }, { createdAt: 'desc' }],
  })
}

export async function getAssignmentBoard(ctx: OrgContext, assignmentId: string) {
  const assignment = await db.schoolAssignment.findFirst({
    where: { id: assignmentId, orgId: ctx.orgId },
    include: {
      schoolClass: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      submissions: {
        include: {
          enrollment: {
            include: { customer: { select: { displayName: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!assignment) throw notFound('Assignment')
  return assignment
}

export async function updateSubmission(
  ctx: OrgContext,
  input: {
    submissionId: string
    status: string
    score?: string | null
    note?: string | null
  },
) {
  if (!isAssignmentStatus(input.status)) throw validation('Invalid submission status.')
  const row = await db.assignmentSubmission.findFirst({
    where: { id: input.submissionId, orgId: ctx.orgId },
    include: { assignment: { select: { maxScore: true } } },
  })
  if (!row) throw notFound('Submission')

  let score: Decimal | null | undefined
  if (input.score != null && String(input.score).trim() !== '') {
    const n = Number(input.score)
    if (!Number.isFinite(n) || n < 0) throw validation('Score must be zero or greater.')
    if (n > Number(row.assignment.maxScore)) throw validation('Score cannot exceed max.')
    score = new Decimal(n)
  }

  return db.assignmentSubmission.update({
    where: { id: row.id },
    data: {
      status: input.status,
      score: score === undefined ? undefined : score,
      note: input.note?.trim() || null,
      submittedAt:
        input.status === 'SUBMITTED' || input.status === 'GRADED'
          ? row.submittedAt ?? new Date()
          : row.submittedAt,
    },
  })
}

export async function portalSubmit(
  ctx: OrgContext,
  input: {
    customerId: string
    submissionId: string
    attachmentUrl?: string | null
    portalNote?: string | null
  },
) {
  const row = await db.assignmentSubmission.findFirst({
    where: { id: input.submissionId, orgId: ctx.orgId },
    include: {
      enrollment: { select: { customerId: true, billingCustomerId: true } },
    },
  })
  if (!row) throw notFound('Submission')
  if (row.enrollment.customerId !== input.customerId && row.enrollment.billingCustomerId !== input.customerId) {
    throw notFound('Submission')
  }
  if (row.status === 'GRADED' || row.status === 'RETURNED') {
    throw precondition('This submission has already been graded.')
  }

  return db.assignmentSubmission.update({
    where: { id: row.id },
    data: {
      status: 'SUBMITTED',
      submittedAt: row.submittedAt ?? new Date(),
      attachmentUrl: input.attachmentUrl?.trim() || null,
      portalNote: input.portalNote?.trim() || null,
    },
  })
}

export async function listTransportRoutes(ctx: OrgContext) {
  return db.transportRoute.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    include: { _count: { select: { riders: true } } },
    orderBy: { name: 'asc' },
  })
}

export async function upsertTransportRoute(
  ctx: OrgContext,
  input: {
    id?: string
    name: string
    vehicleNote?: string | null
    campusId?: string | null
    feeItemId?: string | null
  },
) {
  const name = input.name.trim()
  if (!name) throw validation('Route name is required.')
  const campusId = (await requireCampus(ctx, input.campusId))?.id ?? null
  const feeItemId = (await requireFeeItem(ctx, input.feeItemId))?.id ?? null
  const data = {
    name,
    vehicleNote: input.vehicleNote?.trim() || null,
    campusId,
    feeItemId,
  }
  if (input.id) {
    const existing = await db.transportRoute.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Route')
    return db.transportRoute.update({ where: { id: input.id }, data })
  }
  try {
    return await db.transportRoute.create({
      data: { orgId: ctx.orgId, ...data },
    })
  } catch {
    throw conflict('Another route already uses that name.')
  }
}

export async function addTransportRider(
  ctx: OrgContext,
  input: { routeId: string; enrollmentId: string; stopName?: string | null },
) {
  const route = await db.transportRoute.findFirst({
    where: { id: input.routeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!route) throw notFound('Route')
  const enrollment = await db.studentEnrollment.findFirst({
    where: { id: input.enrollmentId, orgId: ctx.orgId, status: 'ENROLLED' },
    select: { id: true },
  })
  if (!enrollment) throw notFound('Enrollment')
  try {
    return await db.transportRider.create({
      data: {
        orgId: ctx.orgId,
        routeId: input.routeId,
        enrollmentId: input.enrollmentId,
        stopName: input.stopName?.trim() || null,
      },
    })
  } catch {
    throw conflict('Student is already on this route.')
  }
}

export async function getTransportRoute(ctx: OrgContext, routeId: string) {
  const route = await db.transportRoute.findFirst({
    where: { id: routeId, orgId: ctx.orgId },
    include: {
      riders: {
        include: {
          enrollment: { include: { customer: { select: { displayName: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!route) throw notFound('Route')
  return route
}

export async function listHostel(ctx: OrgContext) {
  return db.hostelBlock.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    include: {
      rooms: {
        include: {
          _count: { select: { allocations: { where: { checkedOutAt: null } } } },
        },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })
}

export async function upsertHostelBlock(
  ctx: OrgContext,
  input: {
    id?: string
    name: string
    campusId?: string | null
    feeItemId?: string | null
  },
) {
  const name = input.name.trim()
  if (!name) throw validation('Block name is required.')
  const campusId = (await requireCampus(ctx, input.campusId))?.id ?? null
  const feeItemId = (await requireFeeItem(ctx, input.feeItemId))?.id ?? null
  const data = { name, campusId, feeItemId }
  if (input.id) {
    const existing = await db.hostelBlock.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Hostel block')
    return db.hostelBlock.update({ where: { id: input.id }, data })
  }
  try {
    return await db.hostelBlock.create({ data: { orgId: ctx.orgId, ...data } })
  } catch {
    throw conflict('Another hostel block already uses that name.')
  }
}

export async function upsertHostelRoom(
  ctx: OrgContext,
  input: { id?: string; blockId: string; name: string; capacity: number; gender?: string | null },
) {
  const name = input.name.trim()
  if (!name) throw validation('Room name is required.')
  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    throw validation('Capacity must be at least 1.')
  }
  const block = await db.hostelBlock.findFirst({
    where: { id: input.blockId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!block) throw notFound('Hostel block')
  const gender = input.gender?.trim() || null
  if (input.id) {
    return db.hostelRoom.update({
      where: { id: input.id },
      data: { name, capacity: input.capacity, gender },
    })
  }
  try {
    return await db.hostelRoom.create({
      data: {
        orgId: ctx.orgId,
        blockId: input.blockId,
        name,
        capacity: input.capacity,
        gender,
      },
    })
  } catch {
    throw conflict('Another room already uses that name in this block.')
  }
}

export async function allocateHostelBed(
  ctx: OrgContext,
  input: { roomId: string; enrollmentId: string; bedLabel?: string | null },
) {
  const room = await db.hostelRoom.findFirst({
    where: { id: input.roomId, orgId: ctx.orgId },
    include: { _count: { select: { allocations: { where: { checkedOutAt: null } } } } },
  })
  if (!room) throw notFound('Room')
  if (hostelRoomFull(room.capacity, room._count.allocations)) {
    throw precondition('This hostel room is full.')
  }
  const enrollment = await db.studentEnrollment.findFirst({
    where: { id: input.enrollmentId, orgId: ctx.orgId, status: 'ENROLLED' },
    select: { id: true },
  })
  if (!enrollment) throw notFound('Enrollment')

  const existing = await db.hostelAllocation.findUnique({
    where: { enrollmentId: input.enrollmentId },
  })
  if (existing && !existing.checkedOutAt) throw conflict('Student already has a hostel bed.')

  const data = {
    roomId: input.roomId,
    enrollmentId: input.enrollmentId,
    bedLabel: input.bedLabel?.trim() || null,
    checkedOutAt: null as Date | null,
  }

  if (existing) {
    return db.hostelAllocation.update({ where: { id: existing.id }, data })
  }

  return db.hostelAllocation.create({
    data: { orgId: ctx.orgId, ...data },
  })
}

export async function checkoutHostel(ctx: OrgContext, allocationId: string) {
  const row = await db.hostelAllocation.findFirst({
    where: { id: allocationId, orgId: ctx.orgId },
    select: { id: true, checkedOutAt: true },
  })
  if (!row) throw notFound('Hostel allocation')
  if (row.checkedOutAt) throw precondition('This hostel bed is already checked out.')
  return db.hostelAllocation.update({
    where: { id: row.id },
    data: { checkedOutAt: new Date() },
  })
}

export async function listAnnouncements(ctx: OrgContext) {
  return db.schoolAnnouncement.findMany({
    where: { orgId: ctx.orgId },
    include: { schoolClass: { select: { id: true, name: true } } },
    orderBy: { publishedOn: 'desc' },
    take: 50,
  })
}

export async function createAnnouncement(
  ctx: OrgContext,
  input: {
    title: string
    body: string
    audience: string
    publishedOn?: string
    classId?: string | null
    notifyParents?: boolean
  },
) {
  const title = input.title.trim()
  const body = input.body.trim()
  if (!title || !body) throw validation('Title and body are required.')
  if (!isSchoolAudience(input.audience)) throw validation('Invalid audience.')
  if (input.classId) {
    const schoolClass = await db.schoolClass.findFirst({
      where: { id: input.classId, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!schoolClass) throw notFound('Class')
  }

  const notifyParents = Boolean(input.notifyParents)
  const announcement = await db.schoolAnnouncement.create({
    data: {
      orgId: ctx.orgId,
      classId: input.classId || null,
      title,
      body,
      audience: input.audience,
      publishedOn: toDate((input.publishedOn || today()).slice(0, 10)),
      notifyParents,
    },
  })

  if (notifyParents) {
    const enrollments = input.classId
      ? await db.studentEnrollment.findMany({
          where: {
            orgId: ctx.orgId,
            status: 'ENROLLED',
            classMembers: { some: { classId: input.classId } },
          },
          select: {
            guardianPhone: true,
            customer: { select: { phone: true, mobile: true } },
            billingCustomer: { select: { phone: true, mobile: true } },
          },
        })
      : await db.studentEnrollment.findMany({
          where: { orgId: ctx.orgId, status: 'ENROLLED' },
          select: {
            guardianPhone: true,
            customer: { select: { phone: true, mobile: true } },
            billingCustomer: { select: { phone: true, mobile: true } },
          },
          take: 2000,
        })

    const text = `${ctx.organization.name}: ${title}\n${body}`.slice(0, 1000)
    const seen = new Set<string>()
    for (const row of enrollments) {
      const phone = guardianPhoneOf(row)
      if (!phone || seen.has(phone)) continue
      seen.add(phone)
      await notifyPhone(phone, text)
    }
  }

  return announcement
}

export async function listDiscipline(ctx: OrgContext, enrollmentId?: string) {
  return db.disciplineRecord.findMany({
    where: {
      orgId: ctx.orgId,
      ...(enrollmentId ? { enrollmentId } : {}),
    },
    include: {
      enrollment: { include: { customer: { select: { displayName: true } } } },
    },
    orderBy: { onDate: 'desc' },
    take: 100,
  })
}

export async function createDiscipline(
  ctx: OrgContext,
  input: {
    enrollmentId: string
    onDate: string
    title: string
    detail?: string | null
    severity: string
  },
) {
  const title = input.title.trim()
  if (!title) throw validation('Title is required.')
  if (!isDisciplineSeverity(input.severity)) throw validation('Invalid severity.')
  const enrollment = await db.studentEnrollment.findFirst({
    where: { id: input.enrollmentId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!enrollment) throw notFound('Enrollment')
  return db.disciplineRecord.create({
    data: {
      orgId: ctx.orgId,
      enrollmentId: input.enrollmentId,
      onDate: toDate(input.onDate.slice(0, 10)),
      title,
      detail: input.detail?.trim() || null,
      severity: input.severity,
    },
  })
}

export async function portalSchoolHome(ctx: OrgContext, customerId: string) {
  const enrollments = await db.studentEnrollment.findMany({
    where: { orgId: ctx.orgId, customerId },
    select: { id: true, classMembers: { select: { classId: true } } },
  })
  const ids = enrollments.map((e) => e.id)
  const classIds = [...new Set(enrollments.flatMap((e) => e.classMembers.map((m) => m.classId)))]
  const [assignments, announcements, transport, hostel, exams] = await Promise.all([
    db.assignmentSubmission.findMany({
      where: { orgId: ctx.orgId, enrollmentId: { in: ids } },
      include: {
        assignment: {
          include: {
            schoolClass: { select: { name: true } },
            subject: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
    db.schoolAnnouncement.findMany({
      where: {
        orgId: ctx.orgId,
        audience: { in: ['ALL', 'PARENTS', 'STUDENTS'] },
        OR: [{ classId: null }, { classId: { in: classIds } }],
      },
      orderBy: { publishedOn: 'desc' },
      take: 20,
    }),
    db.transportRider.findMany({
      where: { orgId: ctx.orgId, enrollmentId: { in: ids } },
      include: { route: true },
    }),
    db.hostelAllocation.findMany({
      where: { orgId: ctx.orgId, enrollmentId: { in: ids }, checkedOutAt: null },
      include: { room: { include: { block: true } } },
    }),
    db.schoolExamSlot.findMany({
      where: { orgId: ctx.orgId, classId: { in: classIds } },
      include: {
        exam: { select: { title: true } },
        subject: { select: { name: true } },
        schoolClass: { select: { name: true } },
      },
      orderBy: [{ onDate: 'asc' }, { startsAt: 'asc' }],
      take: 40,
    }),
  ])
  return { assignments, announcements, transport, hostel, exams }
}

export async function activeEnrollmentsOptions(ctx: OrgContext) {
  const rows = await db.studentEnrollment.findMany({
    where: { orgId: ctx.orgId, status: 'ENROLLED' },
    include: { customer: { select: { displayName: true } } },
    orderBy: { enrolledAt: 'desc' },
    take: 500,
  })
  return rows.map((row) => ({ id: row.id, label: row.customer.displayName }))
}
