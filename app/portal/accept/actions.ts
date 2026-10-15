'use server'

import { portalLoginPath } from '@/lib/portal-login'
import { acceptPortalInviteSchema } from '@/lib/validation/portal'
import { isAppError } from '@/server/errors'
import * as portalService from '@/server/services/portal.service'

export type AcceptPortalState = {
  ok?: boolean
  email?: string
  loginHref?: string
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function acceptPortalInviteForm(
  _prev: AcceptPortalState,
  formData: FormData,
): Promise<AcceptPortalState> {
  const parsed = acceptPortalInviteSchema.safeParse({
    token: formData.get('token'),
    name: formData.get('name'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) {
    return {
      fieldErrors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([key, value]) => [key, value ?? []]),
      ),
      error: 'Please correct the highlighted fields.',
    }
  }

  try {
    const result = await portalService.acceptPortalInvite(parsed.data)
    return {
      ok: true,
      email: result.email,
      loginHref: portalLoginPath(result.orgId),
    }
  } catch (error) {
    if (isAppError(error)) {
      return { error: error.message }
    }
    return { error: 'Something went wrong. Try again or ask for a new invite.' }
  }
}
