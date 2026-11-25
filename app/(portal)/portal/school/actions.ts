'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requirePortalContext } from '@/server/auth/context'
import * as ops from '@/server/services/school-ops.service'

export async function portalSubmitHomeworkAction(formData: FormData) {
  const ctx = await requirePortalContext()
  await ops.portalSubmit(ctx, {
    customerId: ctx.portalCustomerId,
    submissionId: String(formData.get('submissionId') ?? ''),
    attachmentUrl: String(formData.get('attachmentUrl') ?? ''),
    portalNote: String(formData.get('portalNote') ?? ''),
  })
  revalidatePath('/portal/school')
  redirect('/portal/school')
}