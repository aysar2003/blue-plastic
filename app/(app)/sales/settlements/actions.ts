'use server'

import { revalidatePath } from 'next/cache'

import { requireOrgContext } from '@/server/auth/context'
import * as settlement from '@/server/services/marketplace-settlement.service'

export async function saveSeller(formData: FormData) {
  const ctx = await requireOrgContext('vendor:update')
  await settlement.upsertSeller(ctx, {
    vendorId: String(formData.get('vendorId') ?? ''),
    commissionPercent: String(formData.get('commissionPercent') ?? '0'),
  })
  revalidatePath('/sales/settlements')
}

export async function runSettlement(formData: FormData) {
  const ctx = await requireOrgContext('journal:post')
  await settlement.settlePeriod(ctx, {
    periodStart: String(formData.get('periodStart') ?? ''),
    periodEnd: String(formData.get('periodEnd') ?? ''),
    paymentAccountId: String(formData.get('paymentAccountId') || '') || null,
  })
  revalidatePath('/sales/settlements')
  revalidatePath('/journals')
  revalidatePath('/purchases/bills')
}