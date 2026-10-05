import { describe, expect, it } from 'vitest'

import { ASSIGNABLE_ROLES } from '@/lib/roles'
import { PERMISSIONS } from '@/lib/permissions-catalog'
import {
  ROLE_PERMISSIONS,
  can,
  effectivePermissions,
  permissionsFor,
  sanitizePermissions,
} from './permissions'

describe('permission matrix', () => {
  it('gives the owner everything', () => {
    for (const permission of PERMISSIONS) {
      expect(can('OWNER', permission)).toBe(true)
    }
  })

  it('gives a viewer reads and nothing else', () => {
    const viewer = ROLE_PERMISSIONS.VIEWER
    for (const permission of viewer) {
      expect(permission.endsWith(':read')).toBe(true)
    }
    expect(can('VIEWER', 'invoice:create')).toBe(false)
    expect(can('VIEWER', 'journal:post')).toBe(false)
  })

  it('separates transaction entry from ledger authority', () => {
    // A bookkeeper enters the day's work; only an accountant may post a manual
    // journal, reconcile a bank account or close a period.
    expect(can('BOOKKEEPER', 'invoice:create')).toBe(true)
    expect(can('BOOKKEEPER', 'bill:create')).toBe(true)
    expect(can('BOOKKEEPER', 'journal:post')).toBe(false)
    expect(can('BOOKKEEPER', 'period:close')).toBe(false)
    expect(can('BOOKKEEPER', 'bank:reconcile')).toBe(false)

    expect(can('ACCOUNTANT', 'journal:post')).toBe(true)
    expect(can('ACCOUNTANT', 'period:close')).toBe(true)
    expect(can('ACCOUNTANT', 'bank:reconcile')).toBe(true)
  })

  it('keeps sales away from the ledger and from other people', () => {
    expect(can('SALES', 'invoice:create')).toBe(true)
    expect(can('SALES', 'payment:create')).toBe(true)
    expect(can('SALES', 'account:create')).toBe(false)
    expect(can('SALES', 'journal:read')).toBe(false)
    expect(can('SALES', 'bill:create')).toBe(false)
    expect(can('SALES', 'user:invite')).toBe(false)
  })

  it('gives store keepers stock work without the ledger', () => {
    expect(can('STORE_KEEPER', 'inventory:adjust')).toBe(true)
    expect(can('STORE_KEEPER', 'bill:create')).toBe(true)
    expect(can('STORE_KEEPER', 'journal:post')).toBe(false)
    expect(can('STORE_KEEPER', 'user:invite')).toBe(false)
    expect(can('STORE_KEEPER', 'payment:create')).toBe(false)
  })

  it('keeps user management to admins and the owner', () => {
    expect(can('ADMIN', 'user:remove')).toBe(true)
    expect(can('ACCOUNTANT', 'user:remove')).toBe(false)
    expect(can('BOOKKEEPER', 'user:invite')).toBe(false)
  })

  it('escalates monotonically: each role contains the one below it', () => {
    const chain = ['VIEWER', 'BOOKKEEPER', 'ACCOUNTANT', 'ADMIN', 'OWNER'] as const
    for (let i = 1; i < chain.length; i++) {
      const lower = ROLE_PERMISSIONS[chain[i - 1]]
      const higher = ROLE_PERMISSIONS[chain[i]]
      for (const permission of lower) {
        expect(
          higher.has(permission),
          `${chain[i]} should include ${chain[i - 1]}'s "${permission}"`,
        ).toBe(true)
      }
    }
  })

  it('never offers OWNER or CUSTOM as a ready-made assignable role', () => {
    // Ownership moves by explicit transfer; CUSTOM is chosen via the matrix.
    expect(ASSIGNABLE_ROLES).not.toContain('OWNER')
    expect(ASSIGNABLE_ROLES).not.toContain('CUSTOM')
    expect(ASSIGNABLE_ROLES).toContain('STORE_KEEPER')
  })

  it('falls back to viewer for an unknown role', () => {
    expect(permissionsFor('NOPE' as never)).toBe(ROLE_PERMISSIONS.VIEWER)
  })

  it('declares no duplicate permissions', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length)
  })

  it('uses an explicit override list when present', () => {
    const set = effectivePermissions('VIEWER', ['invoice:create', 'invoice:read', 'not:a:perm'])
    expect(set.has('invoice:create')).toBe(true)
    expect(set.has('invoice:read')).toBe(true)
    expect(set.has('org:read')).toBe(false)
    expect(set.size).toBe(2)
  })

  it('gives CUSTOM no access without an override', () => {
    expect(effectivePermissions('CUSTOM', []).size).toBe(0)
    expect(effectivePermissions('CUSTOM', ['report:read']).has('report:read')).toBe(true)
  })

  it('sanitizes and orders permission keys', () => {
    expect(sanitizePermissions(['invoice:create', 'bogus', 'invoice:create', 'org:read'])).toEqual([
      'org:read',
      'invoice:create',
    ])
  })
})
