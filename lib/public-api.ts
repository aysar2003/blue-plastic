/**
 * API paths that may run without a browser session.
 * Everything else under `/api/*` requires a signed-in user (JSON 401 from proxy).
 * Machine/cron/device auth is still enforced inside those route handlers.
 */
export function isPublicApiPath(pathname: string): boolean {
  if (pathname.startsWith('/api/auth')) return true
  if (pathname === '/api/health') return true
  if (pathname === '/api/portal/logo') return true
  if (pathname === '/api/v1/openapi') return true
  if (pathname.startsWith('/api/v1/')) return true
  if (pathname.startsWith('/api/cron/')) return true
  if (pathname === '/api/attendance/punches') return true
  return false
}
