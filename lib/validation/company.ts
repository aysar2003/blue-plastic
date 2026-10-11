import { z } from 'zod'

import { currencyCode, requiredText } from './common'

/** A new separate company on this instance (second database and beyond). */
export const createCompanySchema = z.object({
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
})

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
