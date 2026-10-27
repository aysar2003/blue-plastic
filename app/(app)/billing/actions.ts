'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { FormState } from '@/components/forms/action-state'
import {
  reviewRentPaymentSchema,
  submitRentPaymentSchema,
  updateBillingSettingsSchema,
  upsertPlatformPlanSchema,
} from '@/lib/validation/platform-billing'
import { action } from '@/server/action'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as platformBilling from '@/server/services/platform-billing.service'

export async function submitRentPaymentForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const ctx = await requireOrgContext('org:update')
    const parsed = submitRentPaymentSchema.safeParse({
      planId: formData.get('planId'),
      method: formData.get('method'),
      amount: formData.get('amount'),
      reference: formData.get('reference'),
      notes: formData.get('notes'),
    })
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || '_'
        ;(fieldErrors[key] ??= []).push(issue.message)
      }
      return {
        status: 'error',
        message: 'Please correct the highlighted fields.',
        fieldErrors,
      }
    }
    const fileEntry = formData.get('receipt')
    const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null
    await platformBilling.submitRentPayment(ctx, parsed.data, file)
    revalidatePath('/billing')
    revalidatePath('/databases')
    return {
      status: 'success',
      message: 'Payment submitted. The system owner will confirm and extend your rent.',
    }
  } catch (error) {
    if (isAppError(error)) {
      return { status: 'error', message: error.message, fieldErrors: error.details }
    }
    return { status: 'error', message: 'Could not submit the payment. Try again.' }
  }
}

export const reviewRentPayment = action
  .requires('org:update')
  .input(reviewRentPaymentSchema)
  .handler(async (ctx, input) => {
    const result = await platformBilling.reviewRentPayment(ctx, input)
    revalidatePath('/databases')
    revalidatePath('/billing')
    revalidatePath('/', 'layout')
    return result
  })

export const upsertPlatformPlan = action
  .requires('org:update')
  .input(upsertPlatformPlanSchema)
  .handler(async (ctx, input) => {
    const result = await platformBilling.upsertPlan(ctx, input)
    revalidatePath('/databases/billing')
    revalidatePath('/billing')
    return result
  })

export const togglePlatformPlan = action
  .requires('org:update')
  .input(z.object({ id: z.string().min(1), active: z.boolean() }))
  .handler(async (ctx, input) => {
    const result = await platformBilling.setPlanActive(ctx, input)
    revalidatePath('/databases/billing')
    revalidatePath('/billing')
    return result
  })

export async function updateBillingSettingsForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const ctx = await requireOrgContext('org:update')
    const parsed = updateBillingSettingsSchema.safeParse({
      evcNumber: formData.get('evcNumber'),
      zaadNumber: formData.get('zaadNumber'),
      edahabNumber: formData.get('edahabNumber'),
      bankName: formData.get('bankName'),
      bankAccountName: formData.get('bankAccountName'),
      bankAccountNumber: formData.get('bankAccountNumber'),
      instructions: formData.get('instructions'),
    })
    if (!parsed.success) {
      return { status: 'error', message: 'Please correct the fields.' }
    }
    await platformBilling.updateBillingSettings(ctx, parsed.data)
    revalidatePath('/databases/billing')
    revalidatePath('/billing')
    return { status: 'success', message: 'Payment instructions saved.' }
  } catch (error) {
    if (isAppError(error)) {
      return { status: 'error', message: error.message }
    }
    return { status: 'error', message: 'Could not save settings.' }
  }
}
