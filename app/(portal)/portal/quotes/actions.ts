'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { portalQuoteResponseSchema } from '@/lib/validation/portal'
import { requirePortalContext } from '@/server/auth/context'
import * as portalService from '@/server/services/portal.service'

export async function respondToQuote(formData: FormData) {
  const ctx = await requirePortalContext()
  const parsed = portalQuoteResponseSchema.safeParse({
    id: String(formData.get('id') ?? '').trim(),
    decision: String(formData.get('decision') ?? '').trim(),
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid quote response.')
  }
  await portalService.respondToQuote(ctx, parsed.data.id, parsed.data.decision)
  revalidatePath('/portal/quotes')
  revalidatePath(`/portal/quotes/${parsed.data.id}`)
  redirect(`/portal/quotes/${parsed.data.id}`)
}
