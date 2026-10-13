'use server'

import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { z } from 'zod'

import { signIn } from '@/auth'
import { isNavigationError } from '@/lib/db-error'
import { setupSchema } from '@/lib/validation/auth'
import { isAppError } from '@/server/errors'
import { registerCompany } from '@/server/services/register.service'

export type RegisterState = {
  error?: string
  pending?: boolean
  message?: string
  fieldErrors?: Record<string, string[]>
  values?: Record<string, string>
}

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const raw = Object.fromEntries(formData) as Record<string, string>
  // Unchecked app boxes omit the key — force false so Zod does not keep stale defaults.
  for (const key of [
    'moduleSales',
    'modulePurchases',
    'moduleBanking',
    'moduleInventory',
    'modulePos',
    'moduleAccounting',
    'moduleReports',
  ] as const) {
    raw[key] = formData.get(key) === 'true' || formData.get(key) === 'on' ? 'true' : 'false'
  }
  const values = { ...raw, password: '', confirmPassword: '' }

  const parsed = setupSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values }
  }

  let result
  try {
    result = await registerCompany(parsed.data)
  } catch (error) {
    if (isNavigationError(error)) throw error
    if (isAppError(error)) return { error: error.message, values }
    console.error('[register]', error)
    return { error: 'Your request could not be submitted. Please try again.', values }
  }

  if (result.kind === 'pending') {
    return {
      pending: true,
      message:
        'Your request was sent. You cannot sign in until the system owner approves it under Databases.',
      values: { email: result.email },
    }
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: '/dashboard',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      redirect('/sign-in')
    }
    throw error
  }

  return {}
}

function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  return fieldErrors
}
