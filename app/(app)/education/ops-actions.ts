'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as ops from '@/server/services/school-ops.service'

const PATH = '/education'

export async function saveSubjectAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await ops.upsertSubject(ctx, {
    id: String(formData.get('id') || '') || undefined,
    name: String(formData.get('name') ?? ''),
    code: String(formData.get('code') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/subjects`)
}

export async function linkSubjectAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const classId = String(formData.get('classId') ?? '')
  await ops.linkClassSubject(ctx, {
    classId,
    subjectId: String(formData.get('subjectId') ?? ''),
    teacherName: String(formData.get('teacherName') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/timetable?classId=${encodeURIComponent(classId)}`)
}

export async function saveTimetableSlotAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const classId = String(formData.get('classId') ?? '')
  await ops.upsertTimetableSlot(ctx, {
    id: String(formData.get('id') || '') || undefined,
    classId,
    subjectId: String(formData.get('subjectId') || '') || null,
    dayOfWeek: Number(formData.get('dayOfWeek')),
    periodIndex: Number(formData.get('periodIndex')),
    startsAt: String(formData.get('startsAt') ?? ''),
    endsAt: String(formData.get('endsAt') ?? ''),
    room: String(formData.get('room') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/timetable?classId=${encodeURIComponent(classId)}`)
}

export async function createAssignmentAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const row = await ops.createAssignment(ctx, {
    classId: String(formData.get('classId') ?? ''),
    subjectId: String(formData.get('subjectId') || '') || null,
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
    dueOn: String(formData.get('dueOn') || '') || null,
    maxScore: String(formData.get('maxScore') ?? '100'),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/assignments/${row.id}`)
}

export async function updateSubmissionAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const assignmentId = String(formData.get('assignmentId') ?? '')
  await ops.updateSubmission(ctx, {
    submissionId: String(formData.get('submissionId') ?? ''),
    status: String(formData.get('status') ?? 'ASSIGNED'),
    score: String(formData.get('score') ?? ''),
    note: String(formData.get('note') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/assignments/${assignmentId}`)
}

export async function saveTransportRouteAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const row = await ops.upsertTransportRoute(ctx, {
    id: String(formData.get('id') || '') || undefined,
    name: String(formData.get('name') ?? ''),
    vehicleNote: String(formData.get('vehicleNote') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/transport/${row.id}`)
}

export async function addRiderAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const routeId = String(formData.get('routeId') ?? '')
  await ops.addTransportRider(ctx, {
    routeId,
    enrollmentId: String(formData.get('enrollmentId') ?? ''),
    stopName: String(formData.get('stopName') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/transport/${routeId}`)
}

export async function saveHostelBlockAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await ops.upsertHostelBlock(ctx, {
    id: String(formData.get('id') || '') || undefined,
    name: String(formData.get('name') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/hostel`)
}

export async function saveHostelRoomAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await ops.upsertHostelRoom(ctx, {
    id: String(formData.get('id') || '') || undefined,
    blockId: String(formData.get('blockId') ?? ''),
    name: String(formData.get('name') ?? ''),
    capacity: Number(formData.get('capacity') ?? 4),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/hostel`)
}

export async function allocateHostelAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await ops.allocateHostelBed(ctx, {
    roomId: String(formData.get('roomId') ?? ''),
    enrollmentId: String(formData.get('enrollmentId') ?? ''),
    bedLabel: String(formData.get('bedLabel') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/hostel`)
}

export async function createAnnouncementAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await ops.createAnnouncement(ctx, {
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
    audience: String(formData.get('audience') ?? 'ALL'),
    publishedOn: String(formData.get('publishedOn') || '') || undefined,
  })
  revalidatePath(PATH)
  redirect(`${PATH}/announcements`)
}

export async function createDisciplineAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await ops.createDiscipline(ctx, {
    enrollmentId: String(formData.get('enrollmentId') ?? ''),
    onDate: String(formData.get('onDate') ?? ''),
    title: String(formData.get('title') ?? ''),
    detail: String(formData.get('detail') ?? ''),
    severity: String(formData.get('severity') ?? 'NOTE'),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/discipline`)
}
