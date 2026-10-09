'use server'

import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { z } from 'zod'

import { signIn } from '@/auth'
import { setupSchema } from '@/lib/validation/auth'
import { runSetup } from '@/server/services/setup.service'
import { isNavigationError } from '@/lib/db-error'
import { isAppError } from '@/server/errors'

export type SetupState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  values?: Record<string, string>
}

export async function setupAction(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const raw = Object.fromEntries(formData) as Record<string, string>
  const values = { ...raw, password: '', confirmPassword: '' }

  const parsed = setupSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values }
  }

  try {
    await runSetup(parsed.data)
  } catch (error) {
    if (isNavigationError(error)) throw error
    if (isAppError(error)) return { error: error.message, values }
    console.error('[setup]', error)
    return { error: 'Setup could not be completed. Please try again.', values }
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: '/dashboard',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      // The organisation exists; only the automatic sign-in failed.
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
