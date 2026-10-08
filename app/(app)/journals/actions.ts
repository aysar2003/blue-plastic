'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { toFormState, type FormState } from '@/components/forms/action-state'
import { manualJournalSchema, reverseJournalSchema } from '@/lib/validation/accounting'
import { deleteRecordSchema } from '@/lib/validation/common'
import { action } from '@/server/action'
import * as journalService from '@/server/services/journal.service'

function revalidateLedger() {
  revalidatePath('/journals')
  revalidatePath('/accounts')
  revalidatePath('/reports/trial-balance')
}

export const postManualJournal = action
  .requires('journal:post')
  .input(manualJournalSchema)
  .handler(async (ctx, input) => {
    const journal = await journalService.createManual(ctx, input)
    revalidateLedger()
    return { id: journal.id, journalNumber: journal.journalNumber, total: journal.total }
  })

const journalSearch = z.object({
  number: z.string().trim().max(40).optional(),
  date: z.string().trim().max(10).optional(),
  amount: z.string().trim().max(20).optional(),
})

/** Find opens a posted journal. An empty search lists the latest ones. */
export const findJournals = action
  .requires('journal:read')
  .input(journalSearch)
  .handler((ctx, input) => journalService.find(ctx, input))

export const reverseJournalAction = action
  .requires('journal:reverse')
  .input(reverseJournalSchema)
  .handler(async (ctx, input) => {
    const reversal = await journalService.reverse(ctx, input)
    revalidateLedger()
    revalidatePath(`/journals/${input.journalId}`)
    return { id: reversal.id, journalNumber: reversal.journalNumber }
  })

/**
 * Delete a journal entry.
 *
 * Routed by the service to whatever document produced it, so deleting the entry
 * and deleting the transaction are the same act. See `journal.service.remove`.
 */
export const deleteJournal = action
  .requires('journal:reverse')
  .input(deleteRecordSchema)
  .handler(async (ctx, input) => {
    if (!ctx.features.allowJournalDelete) {
      const { precondition } = await import('@/server/errors')
      throw precondition('Journal delete is turned off in Settings → Configuration.')
    }
    const result = await journalService.remove(ctx, input.id, input.reason)
    revalidateLedger()
    revalidatePath('/sales')
    revalidatePath('/purchases')
    revalidatePath('/banking/accounts')
    revalidatePath('/inventory/stock')
    return result
  })

/**
 * The manual journal form posts JSON rather than flat FormData: its line grid is
 * an array, and flattening then re-parsing it would only invent a chance to lose
 * a line.
 */
export async function postManualJournalForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let parsed: unknown
  try {
    parsed = JSON.parse(String(formData.get('payload') ?? '{}'))
  } catch {
    return { status: 'error', message: 'The entry could not be read. Please try again.' }
  }

  const result = await postManualJournal(parsed)
  return toFormState(
    result,
    result.ok && 'journalNumber' in result.data
      ? `Journal ${result.data.journalNumber} posted.`
      : 'Journal posted.',
  )
}
