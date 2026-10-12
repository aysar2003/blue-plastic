/**
 * Canonical public origin for metadata, emails, and Auth callbacks.
 *
 * Prefer APP_URL (or AUTH_URL) once a custom domain is live, e.g. https://somerp.com.
 * On Vercel without those set, fall back to the deployment host (always HTTPS).
 */
export function resolveSiteUrl(): URL {
  const configured =
    process.env.APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)

  if (configured) {
    try {
      return new URL(configured)
    } catch {
      // fall through
    }
  }

  return new URL('http://localhost:3000')
}
