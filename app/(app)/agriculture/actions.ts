'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as agriculture from '@/server/services/agriculture.service'

export async function linkLotSeasonAction(formData: FormData) {
  const ctx = await requireOrgContext('item:update')
  await agriculture.linkLotSeason(ctx, {
    lotId: String(formData.get('lotId') ?? ''),
    projectId: String(formData.get('projectId') || '') || null,
    trackingCategoryId: String(formData.get('trackingCategoryId') || '') || null,
  })
  revalidatePath('/agriculture')
  redirect('/agriculture')
}
