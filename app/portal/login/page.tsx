import { redirect } from 'next/navigation'

import { LOGIN_PORTAL } from '@/lib/login-paths'

export const dynamic = 'force-dynamic'

/**
 * Legacy portal login URL. Preserve query string for company invite links.
 */
export default async function LegacyPortalLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') qs.set(key, value)
    else if (Array.isArray(value)) {
      for (const item of value) qs.append(key, item)
    }
  }
  const suffix = qs.toString()
  redirect(suffix ? `${LOGIN_PORTAL}?${suffix}` : LOGIN_PORTAL)
}
