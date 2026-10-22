import { describe, expect, it } from 'vitest'

import { afterSignInPath } from '@/lib/after-sign-in'
import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags'
import type { OrgContext } from '@/server/auth/context'
import { permissionsFor } from '@/server/auth/permissions'
import { AppError } from '@/server/errors'
import { assertCustomerDataAccess, assertInvoicePdfAccess } from '@/server/services/portal.service'

function staffCtx(overrides: Partial<OrgContext> = {}): OrgContext {
  return {
    orgId: 'org_1',
    userId: 'user_staff',
    role: 'ADMIN',
    permissions: permissionsFor('ADMIN'),
    isSystemOwner: false,
    canConnect: false,
    portalCustomerId: null,
    features: DEFAULT_FEATURE_FLAGS,
    organization: {
      id: 'org_1',
      name: 'Test Co',
      legalName: null,
      baseCurrency: 'USD',
      fiscalYearStartMonth: 1,
      timeZone: 'UTC',
      allowNegativeStock: false,
      posTillLedgerMode: 'HOLD_OFF_CHART',
      parentOrgId: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      region: null,
      postalCode: null,
      country: null,
      phone: null,
      email: null,
      brandMark: null,
      hasLogo: false,
      updatedAt: new Date(),
    },
    user: { id: 'user_staff', name: 'Staff', email: 'staff@test.invalid', image: null },
    ...overrides,
  }
}

function portalCtx(customerId: string, overrides: Partial<OrgContext> = {}): OrgContext {
  return staffCtx({
    userId: 'user_portal',
    role: 'CUSTOMER',
    permissions: permissionsFor('CUSTOMER'),
    portalCustomerId: customerId,
    user: { id: 'user_portal', name: 'Customer', email: 'customer@test.invalid', image: null },
    ...overrides,
  })
}

describe('customer portal access', () => {
  it('lets a portal user read only their linked customer', () => {
    const ctx = portalCtx('cust_a')
    expect(() => assertCustomerDataAccess(ctx, 'cust_a')).not.toThrow()
    expect(() => assertCustomerDataAccess(ctx, 'cust_b')).toThrow(AppError)
    expect(() => assertInvoicePdfAccess(ctx, 'cust_b')).toThrow(AppError)
  })

  it('lets staff with report:read read any customer statement', () => {
    const ctx = staffCtx()
    expect(() => assertCustomerDataAccess(ctx, 'cust_a')).not.toThrow()
  })

  it('refuses staff without report:read for statements', () => {
    const ctx = staffCtx({
      role: 'SALES',
      permissions: new Set(['invoice:read', 'customer:read']),
    })
    expect(() => assertCustomerDataAccess(ctx, 'cust_a')).toThrow(AppError)
  })

  it('refuses a CUSTOMER membership with no portal link', () => {
    const ctx = portalCtx('cust_a', { portalCustomerId: null })
    expect(() => assertCustomerDataAccess(ctx, 'cust_a')).toThrow(AppError)
  })
})

describe('afterSignInPath for portal', () => {
  it('exports a function that resolves a path string', async () => {
    // Needs a live DB; hosted Supabase URLs are stripped in tests/setup unless ALLOW_DB_TESTS=1.
    if (!process.env.DATABASE_URL) return
    // Without a DB user this returns the staff default; the CUSTOMER branch is
    // covered when loadCompanyAccess finds a CUSTOMER membership.
    await expect(afterSignInPath('missing-user')).resolves.toMatch(/^\/(dashboard|databases|portal)$/)
  })
})
