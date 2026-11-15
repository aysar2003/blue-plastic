'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'

const schema = z.object({
  kind: z.enum(['native', 'webhook']),
  webhookUrl: z.string().optional(),
  webhookSecret: z.string().optional(),
})

export async function updateSignProviderAction(input: z.infer<typeof schema>) {
  try {
    const ctx = await requireOrgContext('org:update')
    const data = schema.parse(input)
    const payload =
      data.kind === 'webhook' && data.webhookUrl?.trim()
        ? {
            kind: 'webhook' as const,
            webhookUrl: data.webhookUrl.trim(),
            webhookSecret: data.webhookSecret?.trim() || undefined,
          }
        : { kind: 'native' as const }
    await organizationService.updateSignProvider(ctx, payload)
    revalidatePath('/settings/organization')
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : 'Failed' }
  }
}