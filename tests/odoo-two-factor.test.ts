import { describe, expect, it } from 'vitest'

import { userMustEnrollTotp } from '@/lib/enforce-two-factor'
import { beginTotpSetupSchema, adminDisableMemberTwoFactorSchema } from '@/lib/validation/user'
import { organizationSecuritySchema } from '@/lib/validation/organization'

describe('Odoo-style enforce two-factor', () => {
  it('does not force enrollment when OFF or already enabled', () => {
    expect(
      userMustEnrollTotp({
        enforce: 'OFF',
        totpEnabled: false,
        audience: 'company',
        role: 'SALES',
      }),
    ).toBe(false)
    expect(
      userMustEnrollTotp({
        enforce: 'STAFF',
        totpEnabled: true,
        audience: 'company',
        role: 'SALES',
      }),
    ).toBe(false)
  })

  it('STAFF enforces desk users but not portal customers', () => {
    expect(
      userMustEnrollTotp({
        enforce: 'STAFF',
        totpEnabled: false,
        audience: 'company',
        role: 'SALES',
      }),
    ).toBe(true)
    expect(
      userMustEnrollTotp({
        enforce: 'STAFF',
        totpEnabled: false,
        audience: 'portal',
        role: 'CUSTOMER',
      }),
    ).toBe(false)
  })

  it('ALL enforces portal too', () => {
    expect(
      userMustEnrollTotp({
        enforce: 'ALL',
        totpEnabled: false,
        audience: 'portal',
        role: 'CUSTOMER',
      }),
    ).toBe(true)
  })
})

describe('Odoo-style TOTP setup validation', () => {
  it('requires current password to begin setup', () => {
    expect(beginTotpSetupSchema.safeParse({}).success).toBe(false)
    expect(beginTotpSetupSchema.safeParse({ currentPassword: 'secret1' }).success).toBe(true)
  })

  it('admin disable needs membership id', () => {
    expect(adminDisableMemberTwoFactorSchema.safeParse({}).success).toBe(false)
    expect(
      adminDisableMemberTwoFactorSchema.safeParse({ membershipId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' })
        .success,
    ).toBe(true)
  })
})

describe('organization security includes enforceTwoFactor', () => {
  it('defaults enforce to OFF', () => {
    const parsed = organizationSecuritySchema.safeParse({
      idleLockSeconds: 900,
      sessionMaxHours: 10,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.enforceTwoFactor).toBe('OFF')
  })

  it('accepts STAFF and ALL', () => {
    for (const enforceTwoFactor of ['STAFF', 'ALL'] as const) {
      const parsed = organizationSecuritySchema.safeParse({
        idleLockSeconds: 900,
        sessionMaxHours: 10,
        enforceTwoFactor,
      })
      expect(parsed.success).toBe(true)
      if (parsed.success) expect(parsed.data.enforceTwoFactor).toBe(enforceTwoFactor)
    }
  })
})
