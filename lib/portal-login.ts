/** Public customer-portal sign-in URL for one company. */
export function portalLoginPath(orgId: string): string {
  return `/portal/login?company=${encodeURIComponent(orgId)}`
}

export function portalLoginUrl(orgId: string, origin?: string | null): string {
  const path = portalLoginPath(orgId)
  const base = (origin || '').replace(/\/$/, '')
  return base ? `${base}${path}` : path
}
