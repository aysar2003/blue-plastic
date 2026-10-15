'use server'

import { AuthError } from 'next-auth'

import { signIn } from '@/auth'
import { afterSignInPath } from '@/lib/after-sign-in'
import { portalLoginPath } from '@/lib/portal-login'
import { signInSchema } from '@/lib/validation/auth'
import { email as emailSchema } from '@/lib/validation/common'
import { db } from '@/server/db'
import * as portalService from '@/server/services/portal.service'

export type PortalSignInState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  /** When email lookup finds a company, the client navigates here. */
  redirectTo?: string
}

/**
 * Same credentials provider as staff sign-in; customers land on `/portal`.
 * Failures stay generic so the form cannot enumerate accounts.
 */
export async function portalSignInAction(
  _prev: PortalSignInState,
  formData: FormData,
): Promise<PortalSignInState> {
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
    const redirectTo = user ? await afterSignInPath(user.id) : '/portal'

    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo,
    })
    return {}
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'That email address and password do not match an active portal login.' }
    }
    throw error
  }
}

/**
 * Step one on the generic portal login: look up company branding from email.
 * Always returns a redirect path — unknown emails stay on the generic form with
 * password shown, so this cannot be used to probe who has a portal login.
 */
export async function resolvePortalCompanyAction(
  _prev: PortalSignInState,
  formData: FormData,
): Promise<PortalSignInState> {
  const parsed = emailSchema.safeParse(String(formData.get('email') ?? ''))
  if (!parsed.success) {
    return { fieldErrors: { email: parsed.error.issues.map((issue) => issue.message) } }
  }

  const email = parsed.data
  const company = await portalService.findPortalCompanyForEmail(email)
  if (company) {
    const path = portalLoginPath(company.orgId)
    return { redirectTo: `${path}&email=${encodeURIComponent(email)}` }
  }
  // No company found — client shows password on the generic page.
  return { redirectTo: `/portal/login?email=${encodeURIComponent(email)}&step=password` }
}
