import { z } from 'zod'

import { calendarDate, chosenNumber, cuid, moneyString, optionalText, requiredText } from './common'

export const transferSchema = z
  .object({
    number: chosenNumber,
    date: calendarDate,
    fromAccountId: cuid,
    toAccountId: cuid,
    amount: moneyString.refine((v) => Number(v) > 0, 'Enter an amount greater than zero'),
    reference: optionalText(60),
    memo: optionalText(500),
  })
  .refine((input) => input.fromAccountId !== input.toAccountId, {
    message: 'Choose two different accounts — a transfer to itself moves nothing',
    path: ['toAccountId'],
  })

export type TransferInput = z.infer<typeof transferSchema>

export const depositSchema = z.object({
  number: chosenNumber,
  date: calendarDate,
  bankAccountId: cuid,
  reference: optionalText(60),
  memo: optionalText(500),
  /** Customer payments being taken to the bank. */
  paymentIds: z.array(cuid).max(500).default([]),
  /** Anything else on the paying-in slip. */
  otherLines: z
    .array(
      z.object({
        accountId: cuid,
        description: optionalText(300),
        amount: moneyString.refine((v) => Number(v) > 0, 'Enter an amount'),
      }),
    )
    .max(100)
    .default([]),
})

export type DepositInput = z.infer<typeof depositSchema>


/* --- Statement import ----------------------------------------------------- */

export const importStatementSchema = z.object({
  accountId: cuid,
  csv: z.string().min(1, 'Upload a statement first').max(4_000_000),
})

export const matchTransactionSchema = z.object({
  importedId: cuid,
  journalLineId: cuid,
})

export const excludeTransactionSchema = z.object({ importedId: cuid })

const optionalId = z
  .union([cuid, z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional()

export const saveFeedLineSchema = z.object({
  id: cuid,
  categoryAccountId: optionalId,
  vendorId: optionalId,
  customerId: optionalId,
  payeeName: optionalText(120),
})

export const postFeedLinesSchema = z.object({
  ids: z.array(cuid).min(1).max(100),
})

export const matchFeedInvoiceSchema = z.object({
  importedId: cuid,
  invoiceId: cuid,
})

export const matchFeedBillSchema = z.object({
  importedId: cuid,
  billId: cuid,
})

export const undoFeedLineSchema = z.object({ id: cuid })

export const createBankRuleSchema = z.object({
  name: requiredText('Rule name', 80),
  contains: requiredText('Text to match', 80),
  accountId: optionalId,
  categoryAccountId: cuid,
  vendorId: optionalId,
  customerId: optionalId,
})

export const chartImportSchema = z.object({
  csv: z.string().min(1, 'Choose a spreadsheet first').max(2_000_000),
})

export const reportNoteSchema = z.object({
  reportKey: z.enum(['profit-loss', 'balance-sheet']),
  body: z.string().trim().max(2000),
})

export const bookmarkSchema = z.object({
  label: requiredText('Name', 80),
  href: z.string().trim().min(1).max(200),
  kind: z.enum(['shortcut', 'pin']),
})

export const registerEntrySchema = z.object({
  accountId: cuid,
  direction: z.enum(['in', 'out']),
  date: calendarDate,
  amount: moneyString.refine((value) => Number(value) > 0, 'Enter an amount greater than zero'),
  categoryAccountId: cuid,
  vendorId: optionalId,
  payeeName: optionalText(120),
  memo: optionalText(300),
})

/* --- Reconciliation ------------------------------------------------------- */

export const startReconciliationSchema = z.object({
  accountId: cuid,
  statementDate: calendarDate,
  statementEndingBalance: z.string().trim().regex(/^-?\d{1,15}(\.\d{1,4})?$/, 'Enter the closing balance'),
})

export const toggleClearedSchema = z.object({
  reconciliationId: cuid,
  journalLineId: cuid,
  cleared: z.coerce.boolean(),
})

export const finishReconciliationSchema = z.object({
  reconciliationId: cuid,
  notes: optionalText(1000),
})

export const undoReconciliationSchema = z.object({
  id: cuid,
  reason: requiredText('Reason', 300),
})
