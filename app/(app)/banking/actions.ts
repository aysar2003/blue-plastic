'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { toFormState, type FormState } from '@/components/forms/action-state'
import { cuid, deleteRecordSchema } from '@/lib/validation/common'
import {
  depositSchema,
  createBankRuleSchema,
  excludeTransactionSchema,
  finishReconciliationSchema,
  matchFeedBillSchema,
  matchFeedInvoiceSchema,
  postFeedLinesSchema,
  registerEntrySchema,
  saveFeedLineSchema,
  undoFeedLineSchema,
  importStatementSchema,
  matchTransactionSchema,
  startReconciliationSchema,
  toggleClearedSchema,
  transferSchema,
  undoReconciliationSchema,
} from '@/lib/validation/banking'
import { action } from '@/server/action'
import * as bankingService from '@/server/services/banking.service'
import * as reconciliationService from '@/server/services/reconciliation.service'
import * as feedService from '@/server/services/bank-feed.service'
import * as importService from '@/server/services/statement-import.service'
import { assertDocumentDeleteAllowed } from '@/server/feature-guards'

function revalidateBanking() {
  revalidatePath('/banking/accounts')
  revalidatePath('/banking/transfers')
  revalidatePath('/banking/deposits')
  revalidatePath('/accounts')
  revalidatePath('/reports/trial-balance')
}

export const createTransfer = action
  .requires('bank:transact')
  .input(transferSchema)
  .handler(async (ctx, input) => {
    const transfer = await bankingService.createTransfer(ctx, input)
    revalidateBanking()
    return transfer
  })

export const createDeposit = action
  .requires('bank:transact')
  .input(depositSchema)
  .handler(async (ctx, input) => {
    const deposit = await bankingService.createDeposit(ctx, input)
    revalidateBanking()
    return deposit
  })

export const deleteTransfer = action
  .requires('bank:transact')
  .input(deleteRecordSchema)
  .handler(async (ctx, input) => {
    assertDocumentDeleteAllowed(ctx)
    const result = await bankingService.removeTransfer(ctx, input.id, input.reason)
    revalidateBanking()
    return result
  })

export const deleteDeposit = action
  .requires('bank:transact')
  .input(deleteRecordSchema)
  .handler(async (ctx, input) => {
    assertDocumentDeleteAllowed(ctx)
    const result = await bankingService.removeDeposit(ctx, input.id, input.reason)
    revalidateBanking()
    return result
  })

/* --- Statement import ----------------------------------------------------- */

export const previewStatement = action
  .requires('bank:import')
  .input(importStatementSchema)
  .handler((ctx, input) => importService.importStatement(ctx, input.accountId, input.csv, { dryRun: true }))

export const runStatementImport = action
  .requires('bank:import')
  .input(importStatementSchema)
  .handler(async (ctx, input) => {
    const result = await importService.importStatement(ctx, input.accountId, input.csv)
    revalidatePath('/banking/import')
    return result
  })

export const matchTransaction = action
  .requires('bank:reconcile')
  .input(matchTransactionSchema)
  .handler(async (ctx, input) => {
    const result = await importService.match(ctx, input.importedId, input.journalLineId)
    revalidatePath('/banking/import')
    return result
  })

export const saveFeedLine = action
  .requires('bank:import')
  .input(saveFeedLineSchema)
  .handler(async (ctx, input) => {
    const result = await feedService.saveLine(ctx, {
      id: input.id,
      categoryAccountId: input.categoryAccountId ?? null,
      vendorId: input.vendorId ?? null,
      customerId: input.customerId ?? null,
      payeeName: input.payeeName ?? null,
    })
    revalidatePath('/banking/import')
    return result
  })

export const postFeedLines = action
  .requires('bank:import')
  .input(postFeedLinesSchema)
  .handler(async (ctx, input) => {
    const result = await feedService.postLines(ctx, input.ids)
    revalidateBanking()
    revalidatePath('/banking/import')
    return result
  })

export const matchFeedInvoice = action
  .requires('bank:import')
  .input(matchFeedInvoiceSchema)
  .handler(async (ctx, input) => {
    const result = await feedService.matchInvoice(ctx, input.importedId, input.invoiceId)
    revalidateBanking()
    revalidatePath('/banking/import')
    revalidatePath('/payments')
    return result
  })

export const matchFeedBill = action
  .requires('bank:import')
  .input(matchFeedBillSchema)
  .handler(async (ctx, input) => {
    const result = await feedService.matchBill(ctx, input.importedId, input.billId)
    revalidateBanking()
    revalidatePath('/banking/import')
    revalidatePath('/bill-payments')
    return result
  })

export const undoFeedLine = action
  .requires('bank:import')
  .input(undoFeedLineSchema)
  .handler(async (ctx, input) => {
    const result = await feedService.undoLine(ctx, input.id)
    revalidateBanking()
    revalidatePath('/banking/import')
    return result
  })

export const createBankRule = action
  .requires('bank:import')
  .input(createBankRuleSchema)
  .handler(async (ctx, input) => {
    const result = await feedService.createRule(ctx, {
      name: input.name,
      contains: input.contains,
      accountId: input.accountId ?? null,
      categoryAccountId: input.categoryAccountId,
      vendorId: input.vendorId ?? null,
      customerId: input.customerId ?? null,
    })
    revalidatePath('/banking/import')
    return result
  })

export const enterOnRegister = action
  .requires('bank:transact')
  .input(registerEntrySchema)
  .handler(async (ctx, input) => {
    const result = await feedService.recordOnAccount(ctx, {
      accountId: input.accountId,
      direction: input.direction,
      date: input.date,
      amount: input.amount,
      categoryAccountId: input.categoryAccountId,
      vendorId: input.vendorId ?? null,
      payeeName: input.payeeName ?? null,
      memo: input.memo ?? null,
    })
    revalidateBanking()
    revalidatePath(`/accounts/${input.accountId}`)
    return result
  })

export const excludeTransaction = action
  .requires('bank:reconcile')
  .input(excludeTransactionSchema)
  .handler(async (ctx, input) => {
    const result = await importService.exclude(ctx, input.importedId)
    revalidatePath('/banking/import')
    return result
  })

export async function suggestionsFor(importedId: string) {
  const { requireOrgContext } = await import('@/server/auth/context')
  const ctx = await requireOrgContext('bank:reconcile')
  const parsed = z.object({ importedId: cuid }).safeParse({ importedId })
  if (!parsed.success) return []

  const suggestions = await importService.suggestMatches(ctx, parsed.data.importedId)
  return suggestions.map((suggestion) => ({
    journalLineId: suggestion.journalLineId,
    journalNumber: suggestion.journalNumber,
    date: suggestion.date.toISOString(),
    description: suggestion.description,
    amount: suggestion.amount.toString(),
    dayGap: suggestion.dayGap,
  }))
}

export async function attachLedgerFile(formData: FormData) {
  const { requireOrgContext } = await import('@/server/auth/context')
  const { storeLedgerFile } = await import('@/server/files/ledger-files')
  const ctx = await requireOrgContext('bank:import')
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return
  const text = (value: FormDataEntryValue | null) => (typeof value === 'string' && value ? value : undefined)
  await storeLedgerFile(ctx, file, {
    importedTransactionId: text(formData.get('importedTransactionId')),
    purchaseDocumentId: text(formData.get('purchaseDocumentId')),
  })
  revalidatePath('/banking/import')
  revalidatePath('/purchases')
}

/* --- Reconciliation ------------------------------------------------------- */

export const startReconciliation = action
  .requires('bank:reconcile')
  .input(startReconciliationSchema)
  .handler(async (ctx, input) => {
    const result = await reconciliationService.start(ctx, input)
    revalidatePath('/banking/accounts')
    return result
  })

export const toggleCleared = action
  .requires('bank:reconcile')
  .input(toggleClearedSchema)
  .handler(async (ctx, input) => {
    await reconciliationService.toggleCleared(ctx, input)
    revalidatePath(`/banking/reconcile/${input.reconciliationId}`)
    return { ok: true as const }
  })

export const clearAll = action
  .requires('bank:reconcile')
  .input(z.object({ reconciliationId: cuid }))
  .handler(async (ctx, input) => {
    await reconciliationService.clearAll(ctx, input.reconciliationId)
    revalidatePath(`/banking/reconcile/${input.reconciliationId}`)
    return { ok: true as const }
  })

export const finishReconciliation = action
  .requires('bank:reconcile')
  .input(finishReconciliationSchema)
  .handler(async (ctx, input) => {
    const result = await reconciliationService.finish(ctx, input.reconciliationId, input.notes)
    revalidatePath('/banking/accounts')
    revalidatePath(`/banking/reconcile/${input.reconciliationId}`)
    return result
  })

export const undoReconciliation = action
  .requires('bank:reconcile')
  .input(undoReconciliationSchema)
  .handler(async (ctx, input) => {
    const result = await reconciliationService.undo(ctx, input.id, input.reason)
    revalidatePath('/banking/accounts')
    return result
  })

/* --- Form adapters -------------------------------------------------------- */

export async function saveTransferForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>
  return toFormState(await createTransfer(values), 'Transfer recorded.')
}

export async function saveDepositForm(_prev: FormState, formData: FormData): Promise<FormState> {
  let parsed: unknown
  try {
    parsed = JSON.parse(String(formData.get('payload') ?? '{}'))
  } catch {
    return { status: 'error', message: 'The deposit could not be read. Please try again.' }
  }
  return toFormState(await createDeposit(parsed), 'Deposit recorded.')
}
