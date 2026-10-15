import { z } from 'zod'

import {
  hasAnyModuleEnabled,
  MODULE_FLAGS,
  MODULE_FORM_KEYS,
  modulesFromFormValues,
  type ModuleFlag,
} from '@/lib/feature-flags'

const boolFlag = z
  .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('on')])
  .transform((v) => v === true || v === 'true' || v === 'on')

const reviewModuleFields = Object.fromEntries(
  MODULE_FLAGS.map((key) => [MODULE_FORM_KEYS[key], boolFlag.optional()]),
) as Record<(typeof MODULE_FORM_KEYS)[ModuleFlag], z.ZodOptional<z.ZodType<boolean>>>

/**
 * System owner reviews a public /register request.
 * On approve, apps may be edited (add or remove from what the applicant asked for).
 */
export const reviewSignupRequestSchema = z
  .object({
    id: z.string().cuid(),
    decision: z.enum(['approve', 'reject']),
    note: z.string().trim().max(500).optional(),
    ...reviewModuleFields,
  })
  .superRefine((v, ctx) => {
    if (v.decision !== 'approve') return
    const data = v as Record<string, unknown>
    const sent = MODULE_FLAGS.some((key) => data[MODULE_FORM_KEYS[key]] !== undefined)
    // When the owner sends an apps override, at least one must stay on.
    if (!sent) return
    if (!hasAnyModuleEnabled(modulesFromFormValues(data))) {
      ctx.addIssue({
        code: 'custom',
        path: ['moduleSales'],
        message: 'Leave at least one app on for this company.',
      })
    }
  })

export type ReviewSignupRequestInput = z.infer<typeof reviewSignupRequestSchema>
