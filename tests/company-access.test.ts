import { describe, expect, it } from 'vitest'

import { homeCompanyId, maySwitchCompanies, sessionCompanyId } from '@/lib/company-access'

const home = { orgId: 'home', role: 'SALES', canConnect: false }
const other = { orgId: 'other', role: 'SALES', canConnect: false }
const admin = { orgId: 'admin-co', role: 'ADMIN', canConnect: true }
const adminPlain = { orgId: 'admin-co', role: 'ADMIN', canConnect: false }

describe('company access', () => {
  it('lets only the system owner and a granted admin switch', () => {
    expect(maySwitchCompanies({ isSystemOwner: true, memberships: [home] })).toBe(true)
    expect(maySwitchCompanies({ isSystemOwner: false, memberships: [admin] })).toBe(true)
    expect(maySwitchCompanies({ isSystemOwner: false, memberships: [adminPlain] })).toBe(false)
    expect(maySwitchCompanies({ isSystemOwner: false, memberships: [home, other] })).toBe(false)
    expect(
      maySwitchCompanies({
        isSystemOwner: false,
        memberships: [{ role: 'ACCOUNTANT', canConnect: true }],
      }),
    ).toBe(false)
  })

  it('sends a person to the company they were given, not a later one', () => {
    expect(homeCompanyId('home', [other, home])).toBe('home')
    expect(homeCompanyId('missing', [other, home])).toBe('other')
    expect(homeCompanyId(null, [])).toBeNull()
  })

  it('ignores a switch request from someone who cannot connect', () => {
    expect(
      sessionCompanyId({
        isSystemOwner: false,
        maySwitch: false,
        sessionOrgId: 'other',
        homeOrgId: 'home',
        memberships: [home, other],
      }),
    ).toBe('home')
  })

  it('keeps a granted admin inside a company they belong to', () => {
    expect(
      sessionCompanyId({
        isSystemOwner: false,
        maySwitch: true,
        sessionOrgId: 'other',
        homeOrgId: 'home',
        memberships: [home, { ...other, role: 'ADMIN', canConnect: true }],
      }),
    ).toBe('other')
  })

  it('lets the system owner name any company, even one they have not joined', () => {
    expect(
      sessionCompanyId({
        isSystemOwner: true,
        maySwitch: true,
        sessionOrgId: 'brand-new',
        homeOrgId: 'home',
        memberships: [home],
      }),
    ).toBe('brand-new')
  })
})
