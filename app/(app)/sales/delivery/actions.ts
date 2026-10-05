'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { toFormState, type FormState } from '@/components/forms/action-state'
import { action } from '@/server/action'
import * as salesDelivery from '@/server/services/sales-delivery.service'

const updateSchema = z.object({
  id: z.string().min(1),
  carrier: z.string().max(200).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
})

export const updateDeliveryNote = action
  .requires('invoice:update')
  .input(updateSchema)
  .handler(async (ctx, input) => {
    const result = await salesDelivery.updateNotes(ctx, input.id, {
      carrier: input.carrier,
      notes: input.notes,
    })
    revalidatePath('/sales/delivery')
    revalidatePath(`/sales/delivery/${result.id}`)
    revalidatePath(`/sales/delivery/${result.id}/print`)
    revalidatePath('/customers')
    return result
  })

export async function updateDeliveryNoteForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await updateDeliveryNote({
    id: String(formData.get('id') ?? ''),
    carrier: formData.get('carrier') ? String(formData.get('carrier')) : null,
    notes: formData.get('notes') ? String(formData.get('notes')) : null,
  })
  return toFormState(
    result,
    result.ok && 'number' in result.data
      ? `Delivery note ${result.data.number} updated.`
      : 'Saved.',
  )
}
