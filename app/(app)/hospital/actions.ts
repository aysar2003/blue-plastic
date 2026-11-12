'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as hospital from '@/server/services/hospital.service'

const PATH = '/hospital'

export async function openVisitAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await hospital.openVisit(ctx, {
    customerId: String(formData.get('customerId') ?? ''),
    trackingCategoryId: String(formData.get('trackingCategoryId') || '') || null,
    payerName: String(formData.get('payerName') ?? ''),
    payerRef: String(formData.get('payerRef') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/visits`)
}

export async function addChargeAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await hospital.addCharge(ctx, {
    visitId: String(formData.get('visitId') ?? ''),
    itemId: String(formData.get('itemId') || '') || null,
    description: String(formData.get('description') ?? ''),
    quantity: String(formData.get('quantity') ?? '1'),
    unitPrice: String(formData.get('unitPrice') ?? ''),
    billCode: String(formData.get('billCode') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/visits`)
}

export async function closeVisitAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const result = await hospital.closeVisit(ctx, String(formData.get('visitId') ?? ''))
  revalidatePath(PATH)
  redirect(`/sales/invoices/${result.invoiceId}`)
}

export async function cancelVisitAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await hospital.cancelVisit(ctx, String(formData.get('visitId') ?? ''))
  revalidatePath(PATH)
  redirect(`${PATH}/visits`)
}

export async function stampClaimsExportAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const format = String(formData.get('format') ?? 'json') === 'csv' ? 'csv' : 'json'
  const includeExported = formData.get('includeExported') === '1'
  await hospital.exportClaims(ctx, {
    format,
    status: 'CLOSED',
    includeExported,
    stamp: true,
  })
  revalidatePath(PATH)
  redirect(
    `${PATH}/claims?format=${format}${includeExported ? '&includeExported=1' : ''}`,
  )
}
