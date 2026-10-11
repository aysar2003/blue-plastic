'use server'

import { AuthError } from 'next-auth'

import { signIn } from '@/auth'
import { afterSignInPath } from '@/lib/after-sign-in'
import { signInSchema } from '@/lib/validation/auth'
import { db } from '@/server/db'

export type SignInState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

/**
 * Sign-in deliberately returns one generic message for every failure — wrong
 * password, unknown address, suspended membership. Distinguishing them turns the
 * form into an account-enumeration oracle.
 */
export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
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

  try {
    const email = parsed.data.email.trim().toLowerCase()
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    })
    const redirectTo = user ? await afterSignInPath(user.id) : '/dashboard'

    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo,
    })
    return {}
  } catch (error) {
    // `signIn` signals a successful redirect by throwing; let that through.
    if (error instanceof AuthError) {
      return { error: 'That email address and password do not match an active account.' }
    }
    throw error
  }
}
