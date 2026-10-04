'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import { cuid, optionalText, requiredText } from '@/lib/validation/common'
import { paymentTermSchema, taxCodeSchema, taxRateSchema } from '@/lib/validation/master-data'
import { action } from '@/server/action'
import * as taxService from '@/server/services/tax.service'

const revalidateTax = () => {
  revalidatePath('/settings/tax')
  revalidatePath('/items')
}

export const saveAgency = action
  .requires('tax:manage')
  .input(
    z.object({
      id: z.union([cuid, z.literal('')]).transform((v) => (v === '' ? null : v)).nullable().optional(),
      name: requiredText('Name', 120),
      registrationNumber: optionalText(60),
      filingFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY']),
    }),
  )
  .handler(async (ctx, input) => {
    const agency = await taxService.upsertAgency(ctx, input)
    revalidateTax()
    return { id: agency.id }
  })

export const saveRate = action
  .requires('tax:manage')
  .input(taxRateSchema)
  .handler(async (ctx, input) => {
    const rate = await taxService.upsertRate(ctx, input)
    revalidateTax()
    return { id: rate.id }
  })

export const saveCode = action
  .requires('tax:manage')
  .input(taxCodeSchema)
  .handler(async (ctx, input) => {
    const code = await taxService.upsertCode(ctx, input)
    revalidateTax()
    return { id: code.id }
  })

export const setCodeActive = action
  .requires('tax:manage')
  .input(z.object({ id: cuid, isActive: z.coerce.boolean() }))
  .handler(async (ctx, input) => {
    await taxService.setCodeActive(ctx, input.id, input.isActive)
    revalidateTax()
    return { id: input.id }
  })

export const savePaymentTerm = action
  .requires('tax:manage')
  .input(paymentTermSchema)
  .handler(async (ctx, input) => {
    const term = await taxService.upsertPaymentTerm(ctx, input)
    revalidatePath('/settings/payment-terms')
    revalidatePath('/customers')
    revalidatePath('/vendors')
    return { id: term.id }
  })

/* --- Form adapters -------------------------------------------------------- */

export async function saveAgencyForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await saveAgency(formValues(formData)), 'Tax agency saved.')
}

export async function saveRateForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await saveRate(formValues(formData)), 'Tax rate saved.')
}

export async function savePaymentTermForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await savePaymentTerm(formValues(formData)), 'Payment term saved.')
}

/** The tax-code form carries an ordered list of rates, so it posts JSON. */
export async function saveCodeForm(_prev: FormState, formData: FormData): Promise<FormState> {
  let parsed: unknown
  try {
    parsed = JSON.parse(String(formData.get('payload') ?? '{}'))
  } catch {
    return { status: 'error', message: 'The tax code could not be read. Please try again.' }
  }
  return toFormState(await saveCode(parsed), 'Tax code saved.')
}
