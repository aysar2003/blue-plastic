'use server'

import type { FormState } from '@/components/forms/action-state'
import { isAppError } from '@/server/errors'
import * as marketingLeadService from '@/server/services/marketing-lead.service'

export async function submitMarketingLeadForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await marketingLeadService.createLead({
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? '') || null,
      companyName: String(formData.get('companyName') ?? '') || null,
      message: String(formData.get('message') ?? '') || null,
    })
    return {
      status: 'success',
      message: 'Thanks — we will contact you about your company trial.',
    }
  } catch (error) {
    if (isAppError(error)) {
      return {
        status: 'error',
        message: error.message,
        fieldErrors: error.details,
      }
    }
    return { status: 'error', message: 'Could not send your request. Try again or email us.' }
  }
}
