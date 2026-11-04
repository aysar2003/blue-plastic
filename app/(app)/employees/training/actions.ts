'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as training from '@/server/services/training.service'

const PATH = '/employees/training'

export async function createCourse(formData: FormData) {
  const ctx = await requireOrgContext('hr:update')
  await training.createCourse(ctx, {
    title: String(formData.get('title') ?? ''),
    hours: String(formData.get('hours') ?? ''),
    description: String(formData.get('description') ?? ''),
  })
  revalidatePath(PATH)
  redirect(PATH)
}

export async function enroll(formData: FormData) {
  const ctx = await requireOrgContext('hr:update')
  await training.enroll(ctx, {
    courseId: String(formData.get('courseId') ?? ''),
    employeeId: String(formData.get('employeeId') ?? ''),
  })
  revalidatePath(PATH)
  redirect(PATH)
}

export async function completeEnrollment(formData: FormData) {
  const ctx = await requireOrgContext('hr:update')
  await training.completeEnrollment(ctx, String(formData.get('id') ?? ''))
  revalidatePath(PATH)
  redirect(PATH)
}

export async function failEnrollment(formData: FormData) {
  const ctx = await requireOrgContext('hr:update')
  await training.failEnrollment(ctx, String(formData.get('id') ?? ''))
  revalidatePath(PATH)
  redirect(PATH)
}
