'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as sis from '@/server/services/school-sis.service'

const PATH = '/education'

export async function saveClassAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const row = await sis.upsertClass(ctx, {
    id: String(formData.get('id') || '') || undefined,
    name: String(formData.get('name') ?? ''),
    code: String(formData.get('code') ?? ''),
    teacherName: String(formData.get('teacherName') ?? ''),
    teacherEmployeeId: String(formData.get('teacherEmployeeId') || '') || null,
    campusId: String(formData.get('campusId') || '') || null,
    programId: String(formData.get('programId') ?? ''),
    termId: String(formData.get('termId') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/classes/${row.id}`)
}

export async function addClassMemberAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const classId = String(formData.get('classId') ?? '')
  await sis.addClassMember(ctx, classId, String(formData.get('enrollmentId') ?? ''))
  revalidatePath(PATH)
  redirect(`${PATH}/classes/${classId}`)
}

export async function removeClassMemberAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const member = await sis.removeClassMember(ctx, String(formData.get('memberId') ?? ''))
  revalidatePath(PATH)
  redirect(`${PATH}/classes/${member.classId}`)
}

export async function saveAttendanceAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const classId = String(formData.get('classId') ?? '')
  const onDate = String(formData.get('onDate') ?? '')
  const enrollmentIds = formData.getAll('enrollmentId').map(String)
  const rows = enrollmentIds.map((enrollmentId) => ({
    enrollmentId,
    mark: String(formData.get(`mark_${enrollmentId}`) ?? 'PRESENT'),
    note: String(formData.get(`note_${enrollmentId}`) ?? ''),
  }))
  await sis.saveAttendanceDay(ctx, { classId, onDate, rows })
  if (formData.get('notifyAbsences') === '1') {
    await sis.notifyAbsences(ctx, classId, onDate)
  }
  revalidatePath(PATH)
  redirect(`${PATH}/attendance?classId=${encodeURIComponent(classId)}&onDate=${encodeURIComponent(onDate)}`)
}

export async function saveGradeItemAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const classId = String(formData.get('classId') ?? '')
  await sis.upsertGradeItem(ctx, {
    id: String(formData.get('id') || '') || undefined,
    classId,
    name: String(formData.get('name') ?? ''),
    maxScore: String(formData.get('maxScore') ?? '100'),
    weightPercent: String(formData.get('weightPercent') ?? '100'),
    dueOn: String(formData.get('dueOn') || '') || null,
    subjectId: String(formData.get('subjectId') || '') || null,
  })
  revalidatePath(PATH)
  redirect(`${PATH}/grades?classId=${encodeURIComponent(classId)}`)
}

export async function saveGradeScoresAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const gradeItemId = String(formData.get('gradeItemId') ?? '')
  const classId = String(formData.get('classId') ?? '')
  const enrollmentIds = formData.getAll('enrollmentId').map(String)
  const rows = enrollmentIds
    .map((enrollmentId) => {
      const raw = String(formData.get(`score_${enrollmentId}`) ?? '').trim()
      if (!raw) return null
      return {
        enrollmentId,
        score: raw,
        comment: String(formData.get(`comment_${enrollmentId}`) ?? ''),
      }
    })
    .filter((row): row is { enrollmentId: string; score: string; comment: string } => row != null)

  await sis.saveGradeScores(ctx, { gradeItemId, rows })
  revalidatePath(PATH)
  redirect(
    `${PATH}/grades?classId=${encodeURIComponent(classId)}&gradeItemId=${encodeURIComponent(gradeItemId)}`,
  )
}

export async function promoteEnrollmentAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await sis.promoteEnrollment(ctx, {
    enrollmentId: String(formData.get('enrollmentId') ?? ''),
    termId: String(formData.get('termId') ?? ''),
    programId: String(formData.get('programId') || '') || null,
    feePlanId: String(formData.get('feePlanId') || '') || null,
  })
  revalidatePath(PATH)
  redirect(`${PATH}/enrollments`)
}
