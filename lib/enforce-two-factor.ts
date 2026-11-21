/** Odoo-style company enforce for authenticator (TOTP) only. */

export const ENFORCE_TWO_FACTOR_VALUES = ['OFF', 'STAFF', 'ALL'] as const
export type EnforceTwoFactorMode = (typeof ENFORCE_TWO_FACTOR_VALUES)[number]

export function parseEnforceTwoFactor(value: unknown): EnforceTwoFactorMode {
  if (value === 'STAFF' || value === 'ALL' || value === 'OFF') return value
  return 'OFF'
}

/**
 * Whether this login must enroll TOTP before a full session (company enforce).
 * Email OTP alone does not satisfy enforce.
 */
export function userMustEnrollTotp(input: {
  enforce: EnforceTwoFactorMode
  totpEnabled: boolean
  audience: 'staff' | 'company' | 'portal' | null
  role: string | null
}): boolean {
  if (input.totpEnabled) return false
  if (input.enforce === 'OFF') return false
  if (!input.audience) return false
  if (input.enforce === 'ALL') return true
  // STAFF: internal desk users only (not customer portal).
  if (input.audience === 'portal' || input.role === 'CUSTOMER') return false
  return true
}
