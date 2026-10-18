'use server'

import { AuthError } from 'next-auth'

import { signIn } from '@/auth'
import { LOGIN_PORTAL, WRONG_DOOR } from '@/lib/login-paths'
import { portalLoginPath } from '@/lib/portal-login'
import { signInSchema } from '@/lib/validation/auth'
import { email as emailSchema } from '@/lib/validation/common'
import { verifyCredentials } from '@/server/auth/verify-credentials'
import * as portalService from '@/server/services/portal.service'

export type PortalSignInState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  /** When email lookup finds a company, the client navigates here. */
  redirectTo?: string
}

const GENERIC =
  'That email address and password do not match an active portal login.'

/**
 * Same credentials as staff/company doors; only CUSTOMER audience may enter.
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

  const verified = await verifyCredentials(parsed.data.email, parsed.data.password)
  if (!verified) {
    return { error: GENERIC }
  }
  if (verified.audience !== 'portal') {
    return { error: WRONG_DOOR.portal }
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: '/portal',
    })
    return {}
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: GENERIC }
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
  return {
    redirectTo: `${LOGIN_PORTAL}?email=${encodeURIComponent(email)}&step=password`,
  }
}
