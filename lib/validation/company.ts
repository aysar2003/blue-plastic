import { z } from 'zod'

import { currencyCode, requiredText } from './common'

const boolFlag = z
  .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('on')])
  .transform((v) => v === true || v === 'true' || v === 'on')

const companyModulesFields = {
  moduleSales: boolFlag.default(true),
  modulePurchases: boolFlag.default(true),
  moduleBanking: boolFlag.default(true),
  moduleInventory: boolFlag.default(true),
  modulePos: boolFlag.default(true),
  moduleAccounting: boolFlag.default(true),
  moduleReports: boolFlag.default(true),
} as const

function requireAtLeastOneApp(
  v: {
    moduleSales: boolean
    modulePurchases: boolean
    moduleBanking: boolean
    moduleInventory: boolean
    modulePos: boolean
    moduleAccounting: boolean
    moduleReports: boolean
  },
  ctx: z.RefinementCtx,
) {
  const any =
    v.moduleSales ||
    v.modulePurchases ||
    v.moduleBanking ||
    v.moduleInventory ||
    v.modulePos ||
    v.moduleAccounting ||
    v.moduleReports
  if (!any) {
    ctx.addIssue({
      code: 'custom',
      path: ['moduleSales'],
      message: 'Leave at least one app on for this company.',
    })
  }
}

/** A new separate company on this instance (second database and beyond). */
export const createCompanySchema = z
  .object({
    name: requiredText('Company name', 200),
    baseCurrency: currencyCode.default('USD'),
    fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).default(1),
    /** When true, load the default chart of accounts. */
    seedChart: z.boolean().default(true),
    /**
     * Optional main company. When set, the new company becomes a sub-company
     * under that main (max 2 subs). Omit for a standalone / new main company.
     */
    parentOrgId: z.string().min(1).optional().nullable(),
    ...companyModulesFields,
  })
  .superRefine(requireAtLeastOneApp)

export type CreateCompanyInput = z.infer<typeof createCompanySchema>

/** Attach an existing standalone company under a main (system owner). */
export const attachSubCompanySchema = z.object({
  orgId: z.string().min(1),
  parentOrgId: z.string().min(1),
})

export type AttachSubCompanyInput = z.infer<typeof attachSubCompanySchema>

export const switchCompanySchema = z.object({
  orgId: z.string().min(1),
})

/** Remove a company database. Confirm by typing its name. */
export const deleteCompanySchema = z.object({
  orgId: z.string().min(1),
  /** Must match the company name exactly (case-insensitive trim). */
  confirmName: requiredText('Company name', 200),
})

export type DeleteCompanyInput = z.infer<typeof deleteCompanySchema>

/** System-owner limits: lock, rent, seats, and which apps this company may use. */
export const updateCompanyLimitsSchema = z
  .object({
    orgId: z.string().min(1),
    accessRestricted: boolFlag.default(false),
    /** Empty string clears the rent end date. */
    rentExpiresAt: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => {
        if (v == null || v === '') return null
        const date = new Date(v)
        if (Number.isNaN(date.getTime())) {
          throw new z.ZodError([
            {
              code: 'custom',
              path: ['rentExpiresAt'],
              message: 'Enter a valid rent end date.',
            },
          ])
        }
        return date.toISOString()
      }),
    /** Empty or 0 clears the seat cap (unlimited). */
    maxUsers: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .optional()
      .transform((v) => {
        if (v == null || v === '') return null
        const n = typeof v === 'number' ? v : Number(v)
        if (!Number.isFinite(n) || n < 0) {
          throw new z.ZodError([
            {
              code: 'custom',
              path: ['maxUsers'],
              message: 'Max users must be a number, or blank for unlimited.',
            },
          ])
        }
        if (n === 0) return null
        return Math.min(500, Math.floor(n))
      }),
    rentNote: z
      .string()
      .trim()
      .max(200)
      .optional()
      .nullable()
      .transform((v) => (v == null || v === '' ? null : v)),
    ...companyModulesFields,
  })
  .superRefine(requireAtLeastOneApp)

export type UpdateCompanyLimitsInput = z.infer<typeof updateCompanyLimitsSchema>
