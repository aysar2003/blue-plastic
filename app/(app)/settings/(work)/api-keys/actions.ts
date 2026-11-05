'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { action } from '@/server/action'
import * as apiKeyService from '@/server/services/api-key.service'

const PATH = '/settings/api-keys'

const createInput = z.object({
  name: z.string(),
  scopes: z.array(z.string()),
})

export const createApiKey = action
  .requires('org:update')
  .input(createInput)
  .handler(async (ctx, input) => {
    const parsed = apiKeyService.parseApiKeyCreate(input)
    const created = await apiKeyService.createKey(ctx, parsed)
    revalidatePath(PATH)
    return created
  })

export const revokeApiKey = action
  .requires('org:update')
  .input(z.object({ id: z.string().min(1) }))
  .handler(async (ctx, input) => {
    await apiKeyService.revokeKey(ctx, input.id)
    revalidatePath(PATH)
    return { id: input.id }
  })

