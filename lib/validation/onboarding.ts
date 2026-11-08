import { z } from 'zod'

import { getPack } from '@/lib/packs'

export const completeOnboardingSchema = z.object({
  packId: z
    .string()
    .min(1)
    .refine((id) => getPack(id) != null, { message: 'Unknown industry pack.' }),
  seedChart: z
    .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('on')])
    .transform((v) => v === true || v === 'true' || v === 'on')
    .default(true),
})

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>

export const skipOnboardingSchema = z.object({
  reason: z.string().trim().max(200).optional(),
})

export type SkipOnboardingInput = z.infer<typeof skipOnboardingSchema>

export const toggleChecklistItemSchema = z.object({
  itemId: z.string().trim().min(1).max(80),
  done: z.boolean(),
})

export type ToggleChecklistItemInput = z.infer<typeof toggleChecklistItemSchema>
