import { z } from 'zod'

import {
  hasAnyModuleEnabled,
  MODULE_FLAGS,
  MODULE_FORM_KEYS,
  modulesFromFormValues,
  type ModuleFlag,
} from '@/lib/feature-flags'
import { currencyCode, email, password, requiredText } from './common'

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
})

export type SignInInput = z.infer<typeof signInSchema>

const boolFlag = z
  .union([z.literal('true'), z.literal('false'), z.literal('on'), z.boolean()])
  .transform((v) => v === true || v === 'true' || v === 'on')

const setupModuleFields = Object.fromEntries(
  MODULE_FLAGS.map((key) => [MODULE_FORM_KEYS[key], boolFlag.default(false)]),
) as Record<(typeof MODULE_FORM_KEYS)[ModuleFlag], z.ZodDefault<z.ZodType<boolean>>>

/** First-run setup / public register: company, owner, and which apps they need. */
export const setupSchema = z
  .object({
    organizationName: requiredText('Organisation name', 200),
    baseCurrency: currencyCode.default('USD'),
    fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).default(1),
    name: requiredText('Your name', 120),
    email,
    password,
    confirmPassword: z.string(),
    // Unchecked boxes are omitted from FormData — treat missing as off.
    ...setupModuleFields,
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .superRefine((v, ctx) => {
    const modules = modulesFromFormValues(v as Record<string, unknown>)
    if (!hasAnyModuleEnabled(modules)) {
      ctx.addIssue({
        code: 'custom',
        path: ['moduleSales'],
        message: 'Choose at least one app to use.',
      })
    }
  })
  .transform((v) => {
    const modules = modulesFromFormValues(v as Record<string, unknown>)
    const requestedModules = MODULE_FLAGS.reduce(
      (acc, key) => {
        acc[key] = modules[key]
        return acc
      },
      {} as Record<ModuleFlag, boolean>,
    )
    return { ...v, requestedModules }
  })

export type SetupInput = z.infer<typeof setupSchema>
