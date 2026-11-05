'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import { calendarDate, cuid, optionalText, requiredText } from '@/lib/validation/common'
import { action } from '@/server/action'
import * as reportPackService from '@/server/services/report-pack.service'

const packSchema = z.object({
  name: requiredText('Name', 120),
  description: optionalText(500),
  reportKeys: z
    .union([z.array(z.string()), z.string()])
    .transform((value) =>
      Array.isArray(value)
        ? value
        : value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean),
    ),
  cadence: z.enum(['MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY']).default('MANUAL'),
  emailTo: optionalText(200),
  isActive: z.coerce.boolean().optional().default(true),
})

function revalidatePacks(id?: string) {
  revalidatePath('/reports/packs')
  if (id) revalidatePath(`/reports/packs/${id}`)
}

export const createPack = action
  .requires('report:export')
  .input(packSchema)
  .handler(async (ctx, input) => {
    const row = await reportPackService.create(ctx, input)
    revalidatePacks(row.id)
    return row
  })

export const updatePack = action
  .requires('report:export')
  .input(packSchema.extend({ id: cuid }))
  .handler(async (ctx, input) => {
    const { id, ...rest } = input
    const row = await reportPackService.update(ctx, id, rest)
    revalidatePacks(row.id)
    return row
  })

export const deletePack = action
  .requires('report:export')
  .input(z.object({ id: cuid }))
  .handler(async (ctx, input) => {
    const row = await reportPackService.remove(ctx, input.id)
    revalidatePacks()
    return row
  })

export const runPackNow = action
  .requires('report:export')
  .input(
    z.object({
      id: cuid,
      from: calendarDate.optional(),
      to: calendarDate.optional(),
    }),
  )
  .handler(async (ctx, input) => {
    const range =
      input.from && input.to ? { from: input.from, to: input.to } : undefined
    const row = await reportPackService.runPack(ctx, input.id, range)
    revalidatePacks(input.id)
    return row
  })

export async function createPackForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData)
  const keys = formData.getAll('reportKeys').map(String).filter(Boolean)
  const result = await createPack({ ...raw, reportKeys: keys })
  return toFormState(result, result.ok ? 'Pack saved.' : 'Could not save the pack.')
}

export async function runPackForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await runPackNow(formValues(formData))
  return toFormState(
    result,
    result.ok ? 'Pack built. Download the latest run below.' : 'Could not build the pack.',
  )
}

export async function deletePackForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await deletePack(formValues(formData))
  return toFormState(result, result.ok ? 'Pack deleted.' : 'Could not delete the pack.')
}
