'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { TRUSTED_EXTENSIONS } from '@/lib/erp/extensions/registry'
import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'

const entrySchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().max(120).optional(),
  version: z.string().trim().max(40).optional(),
  capabilities: z.array(z.string().trim().min(1).max(80)).optional(),
  requiredPermissions: z.array(z.string().trim().min(1).max(80)).optional(),
})

const schema = z.object({
  entries: z.array(entrySchema).max(50),
})

const BUILTIN = new Set(TRUSTED_EXTENSIONS.map((row) => row.id))

export async function updateTrustedExtensionsAction(input: z.infer<typeof schema>) {
  try {
    const ctx = await requireOrgContext('org:update')
    const data = schema.parse(input)
    const extras = data.entries
      .map((row) => ({
        id: row.id.trim(),
        title: row.title?.trim() || undefined,
        version: row.version?.trim() || undefined,
        capabilities: row.capabilities?.filter(Boolean),
        requiredPermissions: row.requiredPermissions?.filter(Boolean),
      }))
      .filter((row) => row.id.length > 0 && !BUILTIN.has(row.id))
    await organizationService.updateTrustedExtensions(ctx, extras)
    revalidatePath('/settings/organization')
    revalidatePath('/settings/extensions')
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : 'Failed' }
  }
}
