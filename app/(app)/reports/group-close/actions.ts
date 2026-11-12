'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as companyService from '@/server/services/company.service'

const PATH = '/reports/group-close'

export async function setOwnershipAction(formData: FormData) {
  const ctx = await requireOrgContext('org:update')
  await companyService.setSubOwnershipPercent(ctx, {
    orgId: String(formData.get('orgId') ?? ''),
    ownershipPercent: String(formData.get('ownershipPercent') ?? ''),
  })
  revalidatePath(PATH)
  revalidatePath('/reports/consolidation')
  redirect(PATH)
}
