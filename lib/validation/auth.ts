import { z } from 'zod'

import {
  hasAnyModuleEnabled,
  MODULE_FLAGS,
  MODULE_FORM_KEYS,
  modulesFromFormValues,
  type ModuleFlag,
} from '@/lib/feature-flags'
import {
  PACK_IDS,
  getPack,
  modulesWithNeeds,
  parseNeedsFromForm,
  behavioralWithNeeds,
  defaultNeedsSelection,
  packNeedsAcademicYear,
  parseAcademicCalendarFromForm,
  validateAcademicCalendar,
  fiscalStartFromAcademic,
  type RegisterNeedId,
} from '@/lib/packs'
import { normalizePhone } from '@/lib/phone'

import { refineFiscalYearStartDay } from './organization'
import { currencyCode, email, password, requiredText } from './common'

const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null))

const packIdSchema = z.enum(PACK_IDS as unknown as [string, ...string[]])

/** Optional mobile on register / profile — stored as E.164 when present. */
export const optionalPhone = z
  .string()
  .trim()
  .max(32)
  .optional()
  .transform((v, ctx) => {
    if (!v) return null
    const phone = normalizePhone(v)
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid mobile with country code' })
      return z.NEVER
    }
    return phone
  })

/** Login identifier: email address or mobile number (validated lightly; lookup is separate). */
export const loginIdentifier = z
  .string()
  .trim()
  .min(1, 'Email or mobile is required')
  .max(200, 'Use 200 characters or fewer')

export const signInSchema = z.object({
  email: loginIdentifier,
  password: z.string().min(1, 'Password is required'),
})

export type SignInInput = z.infer<typeof signInSchema>

export const twoFactorCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

export type TwoFactorCodeInput = z.infer<typeof twoFactorCodeSchema>

const boolFlag = z
  .union([z.literal('true'), z.literal('false'), z.literal('on'), z.boolean()])
  .transform((v) => v === true || v === 'true' || v === 'on')

const setupModuleFields = Object.fromEntries(
  MODULE_FLAGS.map((key) => [MODULE_FORM_KEYS[key], boolFlag.default(false)]),
) as Record<(typeof MODULE_FORM_KEYS)[ModuleFlag], z.ZodDefault<z.ZodType<boolean>>>

/** First-run setup / public register: company, owner, industry pack (ERP selection). */
export const setupSchema = z
  .object({
    organizationName: requiredText('Organisation name', 200),
    baseCurrency: currencyCode.default('USD'),
    fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).default(1),
    fiscalYearStartDay: z.coerce.number().int().min(1).max(31).default(1),
    name: requiredText('Your name', 120),
    email,
    phone: optionalPhone,
    password,
    confirmPassword: z.string(),
    /** Industry pack from the ERP selection wizard (preferred). */
    packId: packIdSchema.optional(),
    /** School / university Confirm — academic year structure. */
    academicYearLabel: z.string().trim().max(40).optional(),
    termCount: z.coerce.number().int().min(2).max(3).optional(),
    term1StartsOn: optionalIsoDate,
    term1EndsOn: optionalIsoDate,
    term2StartsOn: optionalIsoDate,
    term2EndsOn: optionalIsoDate,
    term3StartsOn: optionalIsoDate,
    term3EndsOn: optionalIsoDate,
    midVacationStartsOn: optionalIsoDate,
    midVacationEndsOn: optionalIsoDate,
    endVacationStartsOn: optionalIsoDate,
    endVacationEndsOn: optionalIsoDate,
    // Legacy module checkboxes — used only when packId is absent.
    ...setupModuleFields,
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .superRefine((v, ctx) => {
    if (packNeedsAcademicYear(v.packId ?? null)) {
      const cal = parseAcademicCalendarFromForm(v as Record<string, unknown>)
      if (!cal) {
        ctx.addIssue({
          code: 'custom',
          path: ['academicYearLabel'],
          message: 'Fill school year: Term 1, Term 2, and vacation dates.',
        })
      } else {
        const err = validateAcademicCalendar(cal)
        if (err) {
          ctx.addIssue({
            code: 'custom',
            path: ['academicYearLabel'],
            message: err,
          })
        }
      }
    } else {
      refineFiscalYearStartDay(v, ctx)
    }
    if (v.packId) {
      if (!getPack(v.packId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['packId'],
          message: 'Choose a valid industry pack.',
        })
      }
      return
    }
    const modules = modulesFromFormValues(v as Record<string, unknown>)
    if (!hasAnyModuleEnabled(modules)) {
      ctx.addIssue({
        code: 'custom',
        path: ['packId'],
        message: 'Choose your industry so we can set up the right workspace.',
      })
    }
  })
  .transform((v) => {
    const pack = v.packId ? getPack(v.packId) : null
    let selectedNeeds = pack ? parseNeedsFromForm(v as Record<string, unknown>) : []
    // No need_* fields → keep pack defaults (legacy / incomplete clients).
    if (pack && selectedNeeds.length === 0) {
      selectedNeeds = Object.entries(defaultNeedsSelection(pack.id))
        .filter(([, on]) => on)
        .map(([id]) => id as RegisterNeedId)
    }
    const modules = pack
      ? modulesWithNeeds(pack.id, selectedNeeds)
      : modulesFromFormValues(v as Record<string, unknown>)
    const requestedModules = MODULE_FLAGS.reduce(
      (acc, key) => {
        acc[key] = modules[key]
        return acc
      },
      {} as Record<ModuleFlag, boolean>,
    )
    const behavioral = pack ? behavioralWithNeeds(pack.id, selectedNeeds) : {}
    const academicCalendar =
      pack && packNeedsAcademicYear(pack.id)
        ? parseAcademicCalendarFromForm(v as Record<string, unknown>)
        : null
    const fiscal = academicCalendar ? fiscalStartFromAcademic(academicCalendar) : null
    return {
      ...v,
      packId: pack?.id ?? null,
      requestedModules,
      selectedNeeds,
      behavioral,
      academicCalendar,
      fiscalYearStartMonth: fiscal?.fiscalYearStartMonth ?? v.fiscalYearStartMonth,
      fiscalYearStartDay: fiscal?.fiscalYearStartDay ?? v.fiscalYearStartDay,
    }
  })

export type SetupInput = z.infer<typeof setupSchema>
