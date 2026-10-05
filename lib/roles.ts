import type { Role } from '@prisma/client'

/**
 * How roles are *presented*. Isomorphic by design: forms, tables and menus need
 * these on the client, while the permission matrix they describe stays on the
 * server in `server/auth/permissions.ts`. Keeping labels out of the server layer
 * is what lets the layering rule be absolute rather than have an exception.
 */
export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  ACCOUNTANT: 'Accountant',
  BOOKKEEPER: 'Bookkeeper',
  SALES: 'Sales',
  STORE_KEEPER: 'Store keeper',
  VIEWER: 'Viewer',
  CUSTOM: 'Custom access',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: 'Full access, including transferring ownership. Cannot be removed.',
  ADMIN: 'Everything except ownership transfer. Manages users and settings.',
  ACCOUNTANT: 'Full accounting authority: chart of accounts, journals, reconciliation, period close.',
  BOOKKEEPER: 'Enters day-to-day transactions. Cannot post manual journals or close periods.',
  SALES: 'Customers, invoices and customer payments only.',
  STORE_KEEPER: 'Stock, store tickets, transfers and receiving — not the full ledger.',
  VIEWER: 'Read-only access to records and reports.',
  CUSTOM: 'Access chosen module by module — not a preset role.',
}

/**
 * Preset roles shown when assigning “ready-made” access.
 * Ownership moves by transfer; CUSTOM is chosen via the manual matrix, not this list.
 */
export const ASSIGNABLE_ROLES: Role[] = [
  'ADMIN',
  'ACCOUNTANT',
  'BOOKKEEPER',
  'SALES',
  'STORE_KEEPER',
  'VIEWER',
]
