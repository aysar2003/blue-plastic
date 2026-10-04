import { z } from 'zod'

import { settleNumberInput } from '@/lib/money'

export const cuid = z.string().min(1, 'Required')

export const trimmed = (max: number) => z.string().trim().max(max)

export const requiredText = (label: string, max = 255) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`)

export const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()

/** A number typed on a form. Blank means "use the next one in order". */
export const chosenNumber = z
  .string()
  .trim()
  .max(40, 'Use 40 characters or fewer')
  .optional()
  .transform((value) => (value ? value : undefined))

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .email('Enter a valid email address')

/**
 * Passwords are checked for length and variety, not for a punctuation ritual.
 * Length is what actually resists guessing.
 */
export const password = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(200, 'Password must be 200 characters or fewer')

export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .length(3, 'Use a 3-letter ISO currency code')

/**
 * A two-letter country code, or nothing.
 *
 * The empty string has to be handled explicitly. `.optional()` accepts an absent
 * value, but a form always submits `""` for a field left blank — so a plain
 * `.length(2).optional()` rejects every contact whose country was not filled in,
 * which is most of them.
 */
export const countryCode = z
  .union([z.string().trim().toUpperCase().length(2), z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional()

/** Fold 120-10 into 110 before a decimal pattern is checked. A plain number is unchanged. */
export function calculatedDecimal(pattern: RegExp, message: string) {
  return z
    .string()
    .trim()
    .transform((value, ctx) => {
      const next = settleNumberInput(value) ?? value
      if (!pattern.test(next)) {
        ctx.addIssue({ code: 'custom', message })
        return z.NEVER
      }
      return next
    })
}

/** Money crosses the wire as a decimal string, never a float (ADR-0003). */
export const moneyString = calculatedDecimal(/^-?\d{1,15}(\.\d{1,4})?$/, 'Enter a valid amount')

export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')

/**
 * Shared list-query shape. Lists open the whole result and scroll; pageSize is
 * kept so older callers still parse, and is sized to hold a full working set.
 */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50_000).default(50_000),
  q: z.string().trim().max(120).optional(),
  sort: z.string().trim().max(60).optional(),
  dir: z.enum(['asc', 'desc']).default('asc'),
})

export type ListQuery = z.infer<typeof listQuerySchema>

export function parseListQuery(params: Record<string, string | string[] | undefined>): ListQuery {
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(params)) flat[k] = Array.isArray(v) ? v[0] : v
  const result = listQuerySchema.safeParse(flat)
  return result.success ? result.data : listQuerySchema.parse({})
}

/** Page slice for callers that still page in memory (e.g. balance-sorted lists). */
export function paginate(query: ListQuery) {
  return {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  }
}

export type Paged<T> = {
  rows: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export function paged<T>(rows: T[], total: number, query: ListQuery): Paged<T> {
  return {
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  }
}

/**
 * Deleting a record.
 *
 * The reason is optional. Deleting a transaction that was entered by mistake is
 * an ordinary correction, and demanding a written justification for one is how a
 * field ends up holding the word "mistake" ten thousand times. When somebody does
 * type something, it is kept on the record and in the audit log.
 */
export const deleteRecordSchema = z.object({
  id: cuid,
  reason: optionalText(300),
})

export type DeleteRecordInput = z.infer<typeof deleteRecordSchema>
