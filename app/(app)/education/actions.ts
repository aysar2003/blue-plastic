'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as education from '@/server/services/education.service'

const PATH = '/education'

export async function saveProgram(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await education.upsertProgram(ctx, {
    id: String(formData.get('id') || '') || undefined,
    name: String(formData.get('name') ?? ''),
    code: String(formData.get('code') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/programs`)
}

export async function saveTerm(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await education.upsertTerm(ctx, {
    id: String(formData.get('id') || '') || undefined,
    name: String(formData.get('name') ?? ''),
    startsOn: String(formData.get('startsOn') ?? ''),
    endsOn: String(formData.get('endsOn') ?? ''),
    academicYearId: String(formData.get('academicYearId') || '') || null,
  })
  revalidatePath(PATH)
  redirect(`${PATH}/terms`)
}

export async function openAcademicYearAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await education.openAcademicYear(ctx, {
    label: String(formData.get('label') ?? '') || undefined,
    copyFromYearId: String(formData.get('copyFromYearId') || '') || null,
    cloneFeePlans: formData.get('cloneFeePlans') === '1',
  })
  revalidatePath(PATH)
  redirect(`${PATH}/years`)
}

export async function closeAcademicYearAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await education.closeAcademicYear(ctx, String(formData.get('yearId') ?? ''))
  revalidatePath(PATH)
  redirect(`${PATH}/years`)
}

export async function promoteEnrollmentsAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await education.promoteEnrollments(ctx, {
    fromYearId: String(formData.get('fromYearId') ?? ''),
    toTermId: String(formData.get('toTermId') ?? ''),
    cloneClasses: formData.get('cloneClasses') === '1',
  })
  revalidatePath(PATH)
  redirect(`${PATH}/enrollments`)
}

export async function completeEnrollmentAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await education.completeEnrollment(ctx, String(formData.get('enrollmentId') ?? ''))
  revalidatePath(PATH)
  redirect(`${PATH}/enrollments`)
}

export async function importStudentsCsvAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const csv = String(formData.get('csv') ?? '')
  const result = await education.importStudentsCsv(ctx, csv)
  revalidatePath(PATH)
  const q = new URLSearchParams({
    createdStudents: String(result.createdStudents),
    createdEnrollments: String(result.createdEnrollments),
    skippedEnrollments: String(result.skippedEnrollments),
    errors: String(result.errors.length),
  })
  redirect(`${PATH}/import?${q.toString()}`)
}

export async function saveFeePlan(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const lines: {
    itemId: string
    quantity: string
    unitPrice?: string | null
    description?: string
  }[] = []

  for (const suffix of ['', '2', '3'] as const) {
    const itemId = String(formData.get(`itemId${suffix}`) ?? '').trim()
    if (!itemId) continue
    lines.push({
      itemId,
      quantity: String(formData.get(`quantity${suffix}`) ?? '1'),
      unitPrice: String(formData.get(`unitPrice${suffix}`) ?? '') || null,
      description: String(formData.get(`description${suffix}`) ?? '') || undefined,
    })
  }

  await education.upsertFeePlan(ctx, {
    id: String(formData.get('id') || '') || undefined,
    name: String(formData.get('name') ?? ''),
    programId: String(formData.get('programId') || '') || null,
    lines,
  })
  revalidatePath(PATH)
  redirect(`${PATH}/fees`)
}

export async function enrollAndBill(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const result = await education.enrollStudent(ctx, {
    customerId: String(formData.get('customerId') ?? ''),
    programId: String(formData.get('programId') ?? ''),
    termId: String(formData.get('termId') ?? ''),
    feePlanId: String(formData.get('feePlanId') || '') || null,
    scholarshipPercent: String(formData.get('scholarshipPercent') ?? '0'),
    notes: String(formData.get('notes') ?? ''),
    billNow: formData.get('billNow') === '1',
  })
  revalidatePath(PATH)
  if (result.invoiceId) {
    redirect(`/sales/invoices/${result.invoiceId}`)
  }
  redirect(`${PATH}/enrollments`)
}

export async function billEnrollmentAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const result = await education.billEnrollment(ctx, String(formData.get('enrollmentId') ?? ''))
  revalidatePath(PATH)
  redirect(`/sales/invoices/${result.invoiceId}`)
}

export async function billTermEnrollmentsAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await education.billTermEnrollments(ctx, String(formData.get('termId') ?? ''))
  revalidatePath(PATH)
  redirect(`${PATH}/enrollments?termId=${encodeURIComponent(String(formData.get('termId') ?? ''))}`)
}

export async function withdrawEnrollmentAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await education.withdrawEnrollment(ctx, String(formData.get('enrollmentId') ?? ''))
  revalidatePath(PATH)
  redirect(`${PATH}/enrollments`)
}

export async function awardScholarshipAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await education.awardScholarship(ctx, {
    enrollmentId: String(formData.get('enrollmentId') ?? ''),
    percent: String(formData.get('percent') ?? '0'),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/enrollments`)
}
