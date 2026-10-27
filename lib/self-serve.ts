/**
 * Public /register stays available so businesses can create (or request) a company.
 * Set SELF_SERVE_COMPANIES=false to hide /register after the first company exists.
 */
export function isSelfServeEnabled(): boolean {
  const raw = process.env.SELF_SERVE_COMPANIES
  if (raw === 'false' || raw === '0') return false
  return true
}

/**
 * When true, public registrations wait for system-owner approval (legacy gate).
 * Default is instant create with a 14-day free trial.
 */
export function isSelfServeApprovalRequired(): boolean {
  const raw = process.env.SELF_SERVE_REQUIRE_APPROVAL
  return raw === 'true' || raw === '1'
}
