import 'server-only'

import { Decimal } from '@/lib/money'
import { toDate, today } from '@/lib/date'
import {
  assertDayOfWeek,
  assertPeriodIndex,
  assertTimeOrder,
  hostelRoomFull,
  isAssignmentStatus,
  isDisciplineSeverity,
  isSchoolAudience,
} from '@/lib/erp/school-ops'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'

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
  input: { classId: string; subjectId: string; teacherName?: string | null },
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
  try {
    return await db.schoolClassSubject.create({
      data: {
        orgId: ctx.orgId,
        classId: input.classId,
        subjectId: input.subjectId,
        teacherName: input.teacherName?.trim() || null,
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

  const data = {
    classId: input.classId,
    subjectId: input.subjectId || null,
    dayOfWeek: input.dayOfWeek,
    periodIndex: input.periodIndex,
    startsAt: input.startsAt.trim(),
    endsAt: input.endsAt.trim(),
    room: input.room?.trim() || null,
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

export async function listTransportRoutes(ctx: OrgContext) {
  return db.transportRoute.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    include: { _count: { select: { riders: true } } },
    orderBy: { name: 'asc' },
  })
}

export async function upsertTransportRoute(
  ctx: OrgContext,
  input: { id?: string; name: string; vehicleNote?: string | null },
) {
  const name = input.name.trim()
  if (!name) throw validation('Route name is required.')
  if (input.id) {
    return db.transportRoute.update({
      where: { id: input.id },
      data: { name, vehicleNote: input.vehicleNote?.trim() || null },
    })
  }
  try {
    return await db.transportRoute.create({
      data: { orgId: ctx.orgId, name, vehicleNote: input.vehicleNote?.trim() || null },
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
        include: { _count: { select: { allocations: true } } },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })
}

export async function upsertHostelBlock(ctx: OrgContext, input: { id?: string; name: string }) {
  const name = input.name.trim()
  if (!name) throw validation('Block name is required.')
  if (input.id) {
    return db.hostelBlock.update({ where: { id: input.id }, data: { name } })
  }
  try {
    return await db.hostelBlock.create({ data: { orgId: ctx.orgId, name } })
  } catch {
    throw conflict('Another hostel block already uses that name.')
  }
}

export async function upsertHostelRoom(
  ctx: OrgContext,
  input: { id?: string; blockId: string; name: string; capacity: number },
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
  if (input.id) {
    return db.hostelRoom.update({
      where: { id: input.id },
      data: { name, capacity: input.capacity },
    })
  }
  try {
    return await db.hostelRoom.create({
      data: { orgId: ctx.orgId, blockId: input.blockId, name, capacity: input.capacity },
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
    include: { _count: { select: { allocations: true } } },
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
  if (existing) throw conflict('Student already has a hostel bed.')

  return db.hostelAllocation.create({
    data: {
      orgId: ctx.orgId,
      roomId: input.roomId,
      enrollmentId: input.enrollmentId,
      bedLabel: input.bedLabel?.trim() || null,
    },
  })
}

export async function listAnnouncements(ctx: OrgContext) {
  return db.schoolAnnouncement.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { publishedOn: 'desc' },
    take: 50,
  })
}

export async function createAnnouncement(
  ctx: OrgContext,
  input: { title: string; body: string; audience: string; publishedOn?: string },
) {
  const title = input.title.trim()
  const body = input.body.trim()
  if (!title || !body) throw validation('Title and body are required.')
  if (!isSchoolAudience(input.audience)) throw validation('Invalid audience.')
  return db.schoolAnnouncement.create({
    data: {
      orgId: ctx.orgId,
      title,
      body,
      audience: input.audience,
      publishedOn: toDate((input.publishedOn || today()).slice(0, 10)),
    },
  })
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
    select: { id: true },
  })
  const ids = enrollments.map((e) => e.id)
  const [assignments, announcements, transport, hostel] = await Promise.all([
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
      },
      orderBy: { publishedOn: 'desc' },
      take: 20,
    }),
    db.transportRider.findMany({
      where: { orgId: ctx.orgId, enrollmentId: { in: ids } },
      include: { route: true },
    }),
    db.hostelAllocation.findMany({
      where: { orgId: ctx.orgId, enrollmentId: { in: ids } },
      include: { room: { include: { block: true } } },
    }),
  ])
  return { assignments, announcements, transport, hostel }
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
