import { z } from 'zod'

import { getPack } from '@/lib/packs'

const boolFlag = z
  .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('on')])
  .transform((v) => v === true || v === 'true' || v === 'on')

/** System owner installs a pack onto a company from Databases → Limits. */
export const installIndustryPackSchema = z.object({
  orgId: z.string().min(1),
  packId: z
    .string()
    .min(1)
    .refine((id) => getPack(id) != null, { message: 'Unknown industry pack.' }),
  seedChart: boolFlag.default(true),
})

export type InstallIndustryPackInput = z.infer<typeof installIndustryPackSchema>
