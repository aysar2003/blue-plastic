import { z } from 'zod'

import { calendarDate, cuid, optionalText, requiredText } from '@/lib/validation/common'
import { manualJournalSchema } from '@/lib/validation/accounting'
import { purchaseDocumentSchema } from '@/lib/validation/purchases'

export const RECURRING_TYPES = ['JOURNAL', 'BILL', 'EXPENSE'] as const
export const RECURRING_FREQUENCIES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const

export const RECURRING_TYPE_LABELS: Record<(typeof RECURRING_TYPES)[number], string> = {
  JOURNAL: 'Journal entry',
  BILL: 'Bill',
  EXPENSE: 'Expense',
}

export const RECURRING_FREQUENCY_LABELS: Record<(typeof RECURRING_FREQUENCIES)[number], string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
}

const journalPayloadSchema = manualJournalSchema.omit({ date: true, number: true })
const purchasePayloadSchema = purchaseDocumentSchema.omit({ date: true, number: true, saveAsDraft: true })

export const recurringTemplateSchema = z
  .object({
    name: requiredText('Name', 120),
    type: z.enum(RECURRING_TYPES),
    frequency: z.enum(RECURRING_FREQUENCIES),
    interval: z.coerce.number().int().min(1).max(52).default(1),
    nextRunOn: calendarDate,
    endOn: z
      .union([calendarDate, z.literal('')])
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .optional(),
    isActive: z
      .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('on'), z.literal('')])
      .optional()
      .transform((v) => v === true || v === 'true' || v === 'on')
      .default(true),
    // Shared form fields — validated per type in superRefine.
    memo: optionalText(1000),
    vendorId: z.string().trim().optional(),
    paymentAccountId: z.string().trim().optional(),
    // Journal lines as parallel arrays from the form, or JSON string.
    journalLinesJson: z.string().optional(),
    // Purchase: single expense line for the common rent/subscription case.
    expenseAccountId: z.string().trim().optional(),
    amount: z.string().trim().optional(),
    lineDescription: optionalText(1000),
  })
  .superRefine((data, ctx) => {
    if (data.endOn && data.endOn < data.nextRunOn) {
      ctx.addIssue({
        code: 'custom',
        path: ['endOn'],
        message: 'End date must be on or after the next run date.',
      })
    }
    if (data.type === 'JOURNAL') {
      let lines: unknown
      try {
        lines = JSON.parse(data.journalLinesJson || '[]')
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['journalLinesJson'],
          message: 'Journal lines are not valid.',
        })
        return
      }
      const parsed = journalPayloadSchema.safeParse({
        memo: data.memo ?? null,
        isAdjusting: false,
        lines,
      })
      if (!parsed.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['journalLinesJson'],
          message: parsed.error.issues[0]?.message ?? 'Check the journal lines.',
        })
      }
    } else {
      if (!data.vendorId) {
        ctx.addIssue({ code: 'custom', path: ['vendorId'], message: 'Choose a vendor.' })
      }
      if (!data.expenseAccountId) {
        ctx.addIssue({
          code: 'custom',
          path: ['expenseAccountId'],
          message: 'Choose the expense account.',
        })
      }
      if (!data.amount || !/^\d+(\.\d{1,4})?$/.test(data.amount) || Number(data.amount) <= 0) {
        ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter an amount greater than zero.' })
      }
      if (data.type === 'EXPENSE' && !data.paymentAccountId) {
        ctx.addIssue({
          code: 'custom',
          path: ['paymentAccountId'],
          message: 'Choose the account the money left.',
        })
      }
    }
  })

export type RecurringTemplateFormInput = z.infer<typeof recurringTemplateSchema>

export function payloadFromForm(input: RecurringTemplateFormInput): Record<string, unknown> {
  if (input.type === 'JOURNAL') {
    const lines = JSON.parse(input.journalLinesJson || '[]') as unknown[]
    return journalPayloadSchema.parse({
      memo: input.memo ?? null,
      isAdjusting: false,
      lines,
    })
  }
  return purchasePayloadSchema.parse({
    vendorId: input.vendorId,
    memo: input.memo ?? null,
    paymentAccountId: input.type === 'EXPENSE' ? input.paymentAccountId : null,
    lines: [
      {
        expenseAccountId: input.expenseAccountId,
        description: input.lineDescription ?? input.name,
        quantity: '1',
        unitPrice: input.amount,
      },
    ],
  })
}

export const recurringUpdateSchema = recurringTemplateSchema.extend({ id: cuid })

export const recurringIdSchema = z.object({ id: cuid })
