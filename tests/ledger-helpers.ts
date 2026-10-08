import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags'
import type { OrgContext } from '@/server/auth/context'
import { permissionsFor } from '@/server/auth/permissions'
import { db, type Tx } from '@/server/db'
import { seedChartOfAccounts } from '@/server/accounting/chart-of-accounts'

class Rollback extends Error {}

/**
 * Run a test body against the real database inside a transaction that is always
 * aborted. Nothing these tests do survives, which is the only responsible way to
 * exercise a live ledger.
 */
export async function inRolledBackTransaction(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await db.$transaction(
      async (tx) => {
        await fn(tx)
        throw new Rollback()
      },
      { maxWait: 20_000, timeout: 120_000 },
    )
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }
}

export type Fixture = {
  ctx: OrgContext
  accounts: Record<string, string>
}

/**
 * A throwaway organisation with the default chart installed, inside the caller's
 * transaction. Returns the account ids the tests reach for by name.
 */
export async function makeOrg(tx: Tx, options: { fiscalYearStartMonth?: number } = {}): Promise<Fixture> {
  const suffix = Math.random().toString(36).slice(2, 10)

  const organization = await tx.organization.create({
    data: {
      name: `Ledger Test ${suffix}`,
      baseCurrency: 'USD',
      fiscalYearStartMonth: options.fiscalYearStartMonth ?? 1,
      timeZone: 'UTC',
    },
    select: {
      id: true, name: true, legalName: true, baseCurrency: true, fiscalYearStartMonth: true,
      timeZone: true, allowNegativeStock: true,
      addressLine1: true, addressLine2: true, city: true, region: true,
      postalCode: true, country: true, phone: true, email: true,
    },
  })

  const user = await tx.user.create({
    data: { email: `ledger-${suffix}@test.invalid`, name: 'Ledger Test' },
    select: { id: true, name: true, email: true, image: true },
  })

  await tx.membership.create({
    data: { orgId: organization.id, userId: user.id, role: 'OWNER', status: 'ACTIVE' },
  })

  await seedChartOfAccounts(tx, organization.id)

  const rows = await tx.ledgerAccount.findMany({
    where: { orgId: organization.id },
    select: { id: true, code: true },
  })

  const accounts: Record<string, string> = {}
  for (const row of rows) accounts[row.code] = row.id

  return {
    ctx: {
      orgId: organization.id,
      userId: user.id,
      role: 'OWNER',
      permissions: permissionsFor('OWNER'),
      features: DEFAULT_FEATURE_FLAGS,
      organization,
      user,
    },
    accounts,
  }
}

/** Account numbers used by the tests, so the intent reads without a lookup. */
export const CODE = {
  cash: '1000',
  bank: '1010',
  receivable: '1100',
  payable: '2000',
  capital: '3000',
  openingBalanceEquity: '3200',
  sales: '4000',
  rent: '6100',
  utilities: '6200',
} as const
