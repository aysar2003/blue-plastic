import { z } from 'zod'

import { calendarDate, chosenNumber, cuid, moneyString, optionalText, requiredText } from './common'

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const

const ACCOUNT_SUBTYPES = [
  'BANK', 'ACCOUNTS_RECEIVABLE', 'UNDEPOSITED_FUNDS', 'INVENTORY', 'OTHER_CURRENT_ASSET',
  'FIXED_ASSET', 'ACCUMULATED_DEPRECIATION', 'OTHER_ASSET',
  'ACCOUNTS_PAYABLE', 'CREDIT_CARD', 'SALES_TAX_PAYABLE', 'OTHER_CURRENT_LIABILITY',
  'LONG_TERM_LIABILITY',
  'OWNERS_EQUITY', 'RETAINED_EARNINGS', 'OPENING_BALANCE_EQUITY', 'DRAWINGS',
  'INCOME', 'OTHER_INCOME', 'SALES_DISCOUNTS',
  'COST_OF_GOODS_SOLD', 'OPERATING_EXPENSE', 'OTHER_EXPENSE', 'DEPRECIATION',
] as const

/** Account numbers sort the chart, so they must be numeric and consistently wide. */
const accountCode = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, 'Use an account number of 4 to 8 digits, for example 6100')

const optionalId = z
  .union([cuid, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

export const accountCreateSchema = z.object({
  code: accountCode,
  name: requiredText('Account name', 120),
  description: optionalText(500),
  type: z.enum(ACCOUNT_TYPES),
  subtype: z.enum(ACCOUNT_SUBTYPES),
  parentId: optionalId,
  /** A finer name under the detail type, such as "Sales of product income". */
  detailType: optionalText(80),

  /**
   * Optional opening balance. Posts a journal against Opening Balance Equity
   * rather than writing a number onto the account — a balance that did not come
   * from a journal is not a balance, it is a decoration.
   */
  openingBalance: z
    .union([moneyString, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  openingBalanceDate: z
    .union([calendarDate, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
})

export type AccountCreateInput = z.infer<typeof accountCreateSchema>

export const accountUpdateSchema = z.object({
  id: cuid,
  code: accountCode,
  name: requiredText('Account name', 120),
  description: optionalText(500),
  parentId: optionalId,
  detailType: optionalText(80),
})

export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>

export const accountArchiveSchema = z.object({
  id: cuid,
  isActive: z.coerce.boolean(),
})

/* --- Journals ------------------------------------------------------------- */

const journalLineSchema = z
  .object({
    accountId: z.string().trim(),
    debit: z.string().trim().default(''),
    credit: z.string().trim().default(''),
    description: z.string().trim().max(300).default(''),
    /**
     * Who the line is with. Required on a receivables or payables line.
     * On any other account it is only a label: it does not change what the
     * customer owes or what is owed to the vendor.
     */
    customerId: optionalId,
    vendorId: optionalId,
  })
  .refine((line) => !(line.debit !== '' && line.credit !== ''), {
    message: 'Enter a debit or a credit, not both',
    path: ['credit'],
  })

export const manualJournalSchema = z.object({
  number: chosenNumber,
  date: calendarDate,
  /** Optional — clearing Opening Balance Equity into capital often has no memo. */
  memo: optionalText(300),
  isAdjusting: z.coerce.boolean().default(false),
  lines: z
    .array(journalLineSchema)
    .min(2, 'A journal needs at least two lines')
    .max(200, 'A journal is limited to 200 lines'),
})

export type ManualJournalInput = z.infer<typeof manualJournalSchema>

export const reverseJournalSchema = z.object({
  journalId: cuid,
  reason: requiredText('Reason', 300),
  date: z
    .union([calendarDate, z.literal('')])
    .transform((v) => (v === '' ? undefined : v))
    .optional(),
})

/* --- Periods -------------------------------------------------------------- */

export const periodStatusSchema = z.object({
  periodId: cuid,
  status: z.enum(['OPEN', 'CLOSED']),
})

export const ensureFiscalYearSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2200),
})

export const closeYearSchema = z.object({
  fiscalYearId: cuid,
})

export const reopenYearSchema = z.object({
  fiscalYearId: cuid,
  // Reopening a reported year is the kind of act that has to leave a sentence
  // behind explaining itself.
  reason: requiredText('Reason', 300),
})

/* --- Reports -------------------------------------------------------------- */

export const dateRangeSchema = z.object({
  from: calendarDate,
  to: calendarDate,
})

export { ACCOUNT_TYPES, ACCOUNT_SUBTYPES }
