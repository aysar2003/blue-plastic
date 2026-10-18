'use server'

import { AuthError } from 'next-auth'

import { signIn } from '@/auth'
import { WRONG_DOOR } from '@/lib/login-paths'
import { signInSchema } from '@/lib/validation/auth'
import { verifyCredentials, type VerifiedAudience } from '@/server/auth/verify-credentials'

export type DoorSignInState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

const REDIRECT: Record<Exclude<VerifiedAudience, null>, string> = {
  staff: '/databases',
  company: '/dashboard',
  portal: '/portal',
}

const GENERIC =
  'That email address and password do not match an active account.'

async function doorSignIn(
  expected: Exclude<VerifiedAudience, null>,
  formData: FormData,
): Promise<DoorSignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_'
      ;(fieldErrors[key] ??= []).push(issue.message)
    }
    return { fieldErrors }
  }

  const verified = await verifyCredentials(parsed.data.email, parsed.data.password)
  if (!verified) {
    return { error: GENERIC }
  }

  if (verified.audience !== expected) {
    return { error: WRONG_DOOR[expected] }
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: REDIRECT[expected],
    })
    return {}
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: GENERIC }
    }
    throw error
  }
}

export async function staffSignInAction(
  _prev: DoorSignInState,
  formData: FormData,
): Promise<DoorSignInState> {
  return doorSignIn('staff', formData)
}

export async function companySignInAction(
  _prev: DoorSignInState,
  formData: FormData,
): Promise<DoorSignInState> {
  return doorSignIn('company', formData)
}
