import { z } from 'zod'

import {
  MODULE_FLAGS,
  MODULE_FORM_KEYS,
  modulesFromFormValues,
  type ModuleFlag,
} from '@/lib/feature-flags'
import { cuid, optionalText } from '@/lib/validation/common'

const boolFlag = z
  .union([z.literal('true'), z.literal('false'), z.literal('on'), z.boolean()])
  .transform((v) => v === true || v === 'true' || v === 'on')

const moduleFields = Object.fromEntries(
  MODULE_FLAGS.map((key) => [MODULE_FORM_KEYS[key], boolFlag.optional()]),
) as Record<string, z.ZodTypeAny>

/** Company asks for apps it does not yet have. */
export const requestAppsSchema = z
  .object({
    note: optionalText(500),
    ...moduleFields,
  })
  .superRefine((data, ctx) => {
    const modules = modulesFromFormValues(data as Record<string, unknown>)
    const asked = MODULE_FLAGS.filter((key) => modules[key])
    if (asked.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Choose at least one app to request.',
      })
    }
  })

export type RequestAppsInput = z.infer<typeof requestAppsSchema>

export function requestedModulesFromInput(input: RequestAppsInput): Record<ModuleFlag, boolean> {
  return modulesFromFormValues(input as Record<string, unknown>)
}

export const reviewAppAccessSchema = z.object({
  id: cuid,
  decision: z.enum(['approve', 'reject']),
  note: optionalText(500),
})

export type ReviewAppAccessInput = z.infer<typeof reviewAppAccessSchema>
