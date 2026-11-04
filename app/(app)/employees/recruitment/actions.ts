'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as hris from '@/server/services/hris.service'

export async function createJobOpening(formData: FormData) {
  const ctx = await requireOrgContext('hr:update')
  const title = String(formData.get('title') ?? '').trim()
  const department = String(formData.get('department') ?? '').trim() || null
  await hris.createJobOpening(ctx, { title, department })
  revalidatePath('/employees/recruitment')
  redirect('/employees/recruitment')
}

export async function createApplicant(formData: FormData) {
  const ctx = await requireOrgContext('hr:update')
  const jobOpeningId = String(formData.get('jobOpeningId') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim() || null
  await hris.createApplicant(ctx, { jobOpeningId, name, email })
  revalidatePath('/employees/recruitment')
  redirect('/employees/recruitment')
}

export async function moveApplicant(formData: FormData) {
  const ctx = await requireOrgContext('hr:update')
  const applicantId = String(formData.get('applicantId') ?? '').trim()
  const status = String(formData.get('status') ?? '') as
    | 'NEW'
    | 'SCREENING'
    | 'INTERVIEW'
    | 'OFFER'
    | 'HIRED'
    | 'REJECTED'
  await hris.moveApplicant(ctx, { applicantId, status })
  revalidatePath('/employees/recruitment')
  revalidatePath('/employees')
  redirect('/employees/recruitment')
}

export async function rejectApplicant(formData: FormData) {
  const ctx = await requireOrgContext('hr:update')
  const applicantId = String(formData.get('applicantId') ?? '').trim()
  await hris.rejectApplicant(ctx, applicantId)
  revalidatePath('/employees/recruitment')
  redirect('/employees/recruitment')
}

export async function reopenOpening(formData: FormData) {
  const ctx = await requireOrgContext('hr:update')
  const jobOpeningId = String(formData.get('jobOpeningId') ?? '').trim()
  await hris.reopenOpening(ctx, jobOpeningId)
  revalidatePath('/employees/recruitment')
  redirect('/employees/recruitment')
}

export async function hireApplicant(formData: FormData) {
  const ctx = await requireOrgContext('hr:update')
  const applicantId = String(formData.get('applicantId') ?? '').trim()
  const hired = await hris.hireApplicant(ctx, applicantId)
  if (!hired.alreadyHired && hired.employeeId) {
    await hris.queueOnboarding(ctx, {
      id: hired.employeeId,
      name: 'name' in hired && hired.name ? hired.name : 'new hire',
    }).catch(() => undefined)
  }
  revalidatePath('/employees/recruitment')
  revalidatePath('/employees')
  revalidatePath('/todos')
  redirect('/employees/recruitment')
}

export async function setLifecycle(formData: FormData) {
  const ctx = await requireOrgContext('hr:update')
  const employeeId = String(formData.get('employeeId') ?? '').trim()
  const status = String(formData.get('status') ?? 'ACTIVE') as 'DRAFT' | 'ACTIVE' | 'LEFT'
  await hris.setEmploymentLifecycle(ctx, { employeeId, status })
  revalidatePath('/employees/recruitment')
  revalidatePath('/employees')
  redirect('/employees/recruitment')
}

export async function syncWage(formData: FormData) {
  const ctx = await requireOrgContext('hr:update')
  const employeeId = String(formData.get('employeeId') ?? '').trim()
  await hris.syncWageFromActiveContract(ctx, employeeId)
  revalidatePath('/employees/recruitment')
  revalidatePath(`/employees/${employeeId}`)
  redirect('/employees/recruitment')
}

export async function createAppraisal(formData: FormData) {
  const ctx = await requireOrgContext('hr:update')
  const employeeId = String(formData.get('employeeId') ?? '').trim()
  const periodLabel = String(formData.get('periodLabel') ?? '').trim()
  const score = String(formData.get('score') ?? '').trim() || null
  const goals = String(formData.get('goals') ?? '').trim() || null
  await hris.createAppraisal(ctx, { employeeId, periodLabel, score, goals })
  revalidatePath('/employees/recruitment')
  redirect('/employees/recruitment')
}
