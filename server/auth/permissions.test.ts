import { describe, expect, it } from 'vitest'

import { ASSIGNABLE_ROLES, mayBypassApprovals } from '@/lib/roles'
import { PERMISSION_GROUPS, PERMISSIONS, STAFF_PERMISSIONS } from '@/lib/permissions-catalog'
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

  it('lets only owner and admin bypass document approvals', () => {
    expect(mayBypassApprovals('OWNER')).toBe(true)
    expect(mayBypassApprovals('ADMIN')).toBe(true)
    expect(mayBypassApprovals('MANAGER')).toBe(false)
    expect(mayBypassApprovals('ACCOUNTANT')).toBe(false)
    expect(mayBypassApprovals('SALES')).toBe(false)
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
    // Reopen / unlock is Owner & Admin only — closed books stay closed.
    expect(can('ACCOUNTANT', 'period:reopen')).toBe(false)
    expect(can('ADMIN', 'period:reopen')).toBe(true)
    expect(can('OWNER', 'period:reopen')).toBe(true)
  })

  it('keeps sales away from the ledger and from other people', () => {
    expect(can('SALES', 'invoice:create')).toBe(true)
    expect(can('SALES', 'payment:create')).toBe(true)
    expect(can('SALES', 'account:create')).toBe(false)
    expect(can('SALES', 'journal:read')).toBe(false)
    expect(can('SALES', 'bill:create')).toBe(false)
    expect(can('SALES', 'user:invite')).toBe(false)
    expect(can('SALES', 'report:overview')).toBe(false)
  })

  it('reserves the business overview for owner, admin, manager, accountant, and sales manager', () => {
    expect(can('OWNER', 'report:overview')).toBe(true)
    expect(can('ADMIN', 'report:overview')).toBe(true)
    expect(can('MANAGER', 'report:overview')).toBe(true)
    expect(can('ACCOUNTANT', 'report:overview')).toBe(true)
    expect(can('SALES_MANAGER', 'report:overview')).toBe(true)
    expect(can('BOOKKEEPER', 'report:overview')).toBe(false)
    expect(can('SALES', 'report:overview')).toBe(false)
    expect(can('PURCHASING', 'report:overview')).toBe(false)
    expect(can('CASHIER', 'report:overview')).toBe(false)
    expect(can('STORE_KEEPER', 'report:overview')).toBe(false)
    expect(can('AUDITOR', 'report:overview')).toBe(false)
    expect(can('VIEWER', 'report:overview')).toBe(false)
    expect(can('CUSTOM', 'report:overview')).toBe(false)
  })

  it('gives manager approvals without ledger close authority', () => {
    expect(can('MANAGER', 'invoice:approve')).toBe(true)
    expect(can('MANAGER', 'bill:create')).toBe(true)
    expect(can('MANAGER', 'journal:post')).toBe(false)
    expect(can('MANAGER', 'period:close')).toBe(false)
    expect(can('MANAGER', 'user:invite')).toBe(false)
  })

  it('keeps purchasing on AP and cashier on the till', () => {
    expect(can('PURCHASING', 'bill:create')).toBe(true)
    expect(can('PURCHASING', 'vendor:create')).toBe(true)
    expect(can('PURCHASING', 'invoice:create')).toBe(false)
    expect(can('CASHIER', 'pos:sell')).toBe(true)
    expect(can('CASHIER', 'payment:create')).toBe(true)
    expect(can('CASHIER', 'bill:create')).toBe(false)
    expect(can('CASHIER', 'journal:post')).toBe(false)
  })

  it('gives auditors the trail without write access', () => {
    expect(can('AUDITOR', 'audit:read')).toBe(true)
    expect(can('AUDITOR', 'report:export')).toBe(true)
    expect(can('AUDITOR', 'invoice:create')).toBe(false)
    expect(can('AUDITOR', 'journal:post')).toBe(false)
  })

  it('lets an override grant or withhold the business overview', () => {
    const granted = effectivePermissions('SALES', ['report:read', 'report:overview'])
    expect(granted.has('report:overview')).toBe(true)
    expect(granted.has('invoice:create')).toBe(false)

    const withheld = effectivePermissions('ADMIN', ['report:read', 'invoice:read'])
    expect(withheld.has('report:overview')).toBe(false)
    expect(withheld.has('report:read')).toBe(true)
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

  it('reserves master-data delete/merge for the owner unless granted in Settings', () => {
    for (const permission of [
      'customer:delete',
      'vendor:delete',
      'item:delete',
      'account:delete',
    ] as const) {
      expect(can('OWNER', permission)).toBe(true)
      expect(can('ADMIN', permission)).toBe(false)
      expect(can('ACCOUNTANT', permission)).toBe(false)
      expect(can('BOOKKEEPER', permission)).toBe(false)
    }
  })

  it('escalates monotonically: each role contains the one below it', () => {
    // OWNER may hold delete capabilities that ADMIN does not — still a strict
    // superset of every lower role's template.
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

  it('never offers OWNER, CUSTOM, or CUSTOMER as a ready-made assignable role', () => {
    // Ownership moves by explicit transfer; CUSTOM is chosen via the matrix;
    // CUSTOMER portal logins are invited from the customer record.
    expect(ASSIGNABLE_ROLES).not.toContain('OWNER')
    expect(ASSIGNABLE_ROLES).not.toContain('CUSTOM')
    expect(ASSIGNABLE_ROLES).not.toContain('CUSTOMER')
    expect(ASSIGNABLE_ROLES).toContain('STORE_KEEPER')
    expect(ASSIGNABLE_ROLES).toContain('MANAGER')
    expect(ASSIGNABLE_ROLES).toContain('SALES_MANAGER')
    expect(ASSIGNABLE_ROLES).toContain('AR_CLERK')
    expect(ASSIGNABLE_ROLES).toContain('PURCHASING_MANAGER')
    expect(ASSIGNABLE_ROLES).toContain('PURCHASING')
    expect(ASSIGNABLE_ROLES).toContain('AP_CLERK')
    expect(ASSIGNABLE_ROLES).toContain('BANK_CLERK')
    expect(ASSIGNABLE_ROLES).toContain('POS_SUPERVISOR')
    expect(ASSIGNABLE_ROLES).toContain('CASHIER')
    expect(ASSIGNABLE_ROLES).toContain('WAREHOUSE_MANAGER')
    expect(ASSIGNABLE_ROLES).toContain('PROJECT_MANAGER')
    expect(ASSIGNABLE_ROLES).toContain('MASTER_DATA')
    expect(ASSIGNABLE_ROLES).toContain('AUDITOR')
  })

  it('keeps department clerks inside their desk', () => {
    expect(can('AR_CLERK', 'invoice:create')).toBe(true)
    expect(can('AR_CLERK', 'bill:create')).toBe(false)
    expect(can('AR_CLERK', 'pos:sell')).toBe(false)
    expect(can('AP_CLERK', 'bill:create')).toBe(true)
    expect(can('AP_CLERK', 'invoice:create')).toBe(false)
    expect(can('AP_CLERK', 'bill:approve')).toBe(false)
    expect(can('BANK_CLERK', 'bank:transact')).toBe(true)
    expect(can('BANK_CLERK', 'bank:reconcile')).toBe(false)
    expect(can('MASTER_DATA', 'customer:create')).toBe(true)
    expect(can('MASTER_DATA', 'vendor:create')).toBe(true)
    expect(can('MASTER_DATA', 'invoice:create')).toBe(false)
    expect(can('PROJECT_MANAGER', 'project:update')).toBe(true)
    expect(can('PROJECT_MANAGER', 'journal:post')).toBe(false)
    expect(can('WAREHOUSE_MANAGER', 'inventory:approve')).toBe(true)
    expect(can('WAREHOUSE_MANAGER', 'item:create')).toBe(true)
    expect(can('POS_SUPERVISOR', 'pos:manage')).toBe(true)
    expect(can('POS_SUPERVISOR', 'journal:post')).toBe(false)
    expect(can('PURCHASING_MANAGER', 'vendor:approve')).toBe(true)
  })

  it('gives CUSTOMER only portal:read and ignores overrides', () => {
    expect(can('CUSTOMER', 'portal:read')).toBe(true)
    expect(can('CUSTOMER', 'invoice:read')).toBe(false)
    expect(can('CUSTOMER', 'report:read')).toBe(false)
    const escalated = effectivePermissions('CUSTOMER', ['invoice:create', 'org:update'])
    expect([...escalated]).toEqual(['portal:read'])
  })

  it('falls back to viewer for an unknown role', () => {
    expect(permissionsFor('NOPE' as never)).toBe(ROLE_PERMISSIONS.VIEWER)
  })

  it('declares no duplicate permissions', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length)
  })

  it('shows every staff permission in the access matrix, including the business overview', () => {
    const shown = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((item) => item.key))
    expect(new Set(shown)).toEqual(new Set(STAFF_PERMISSIONS))
    expect(PERMISSIONS).toContain('portal:read')
    expect(PERMISSIONS).toContain('portal:manage')
    expect(STAFF_PERMISSIONS).not.toContain('portal:read')
    expect(STAFF_PERMISSIONS).toContain('portal:manage')
    expect(can('SALES', 'portal:manage')).toBe(true)
    expect(can('CUSTOMER', 'portal:manage')).toBe(false)
    const reports = PERMISSION_GROUPS.find((group) => group.id === 'reports')
    expect(reports?.permissions.map((item) => item.key)).toContain('report:overview')
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
