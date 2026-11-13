import 'server-only'
import type { AccountSubtype, AccountType, SystemAccountKey } from '@prisma/client'

import type { Tx } from '@/server/db'
import { validation } from '@/server/errors'

type SeedAccount = {
  code: string
  name: string
  type: AccountType
  subtype: AccountSubtype
  systemKey?: SystemAccountKey
  description?: string
}

/**
 * The default chart of accounts for a goods-trading business.
 *
 * Numbering follows the convention every accountant expects, so a new bookkeeper
 * can read it without a legend:
 *
 *   1000-1999  assets        4000-4999  revenue
 *   2000-2999  liabilities   5000-5999  cost of goods sold
 *   3000-3999  equity        6000-7999  expenses
 *
 * Accounts marked with a `systemKey` are the ones the engine refers to by name.
 * They cannot be deleted or repurposed, but their code and name are the
 * business's to change.
 */
export const DEFAULT_CHART: SeedAccount[] = [
  // --- Assets -------------------------------------------------------------
  { code: '1000', name: 'Cash on Hand', type: 'ASSET', subtype: 'BANK' },
  { code: '1010', name: 'Bank Account', type: 'ASSET', subtype: 'BANK' },
  {
    code: '1020',
    name: 'Point of Sale',
    type: 'ASSET',
    subtype: 'OTHER_CURRENT_ASSET',
    description: 'pos-parent',
  },
  {
    code: '1050',
    name: 'Undeposited Funds',
    type: 'ASSET',
    subtype: 'UNDEPOSITED_FUNDS',
    systemKey: 'UNDEPOSITED_FUNDS',
    description: 'Money received but not yet taken to the bank.',
  },
  {
    code: '1100',
    name: 'Accounts Receivable',
    type: 'ASSET',
    subtype: 'ACCOUNTS_RECEIVABLE',
    systemKey: 'ACCOUNTS_RECEIVABLE',
    description: 'Control account. Every line carries the customer it belongs to.',
  },
  {
    code: '1200',
    name: 'Inventory Asset',
    type: 'ASSET',
    subtype: 'INVENTORY',
    systemKey: 'INVENTORY_ASSET',
    description: 'Stock on hand, at weighted-average cost.',
  },
  { code: '1300', name: 'Prepaid Expenses', type: 'ASSET', subtype: 'OTHER_CURRENT_ASSET' },
  { code: '1400', name: 'Property, Plant & Equipment', type: 'ASSET', subtype: 'FIXED_ASSET' },
  {
    code: '1450',
    name: 'Accumulated Depreciation',
    type: 'ASSET',
    subtype: 'ACCUMULATED_DEPRECIATION',
    description: 'Contra-asset. Carries a credit balance.',
  },

  // --- Liabilities --------------------------------------------------------
  {
    code: '2000',
    name: 'Accounts Payable',
    type: 'LIABILITY',
    subtype: 'ACCOUNTS_PAYABLE',
    systemKey: 'ACCOUNTS_PAYABLE',
    description: 'Control account. Every line carries the vendor it belongs to.',
  },
  { code: '2100', name: 'Credit Card', type: 'LIABILITY', subtype: 'CREDIT_CARD' },
  {
    code: '2200',
    name: 'Sales Tax Payable',
    type: 'LIABILITY',
    subtype: 'SALES_TAX_PAYABLE',
    systemKey: 'SALES_TAX_PAYABLE',
    description: 'Tax collected on sales, owed to the tax authority.',
  },
  { code: '2300', name: 'Accrued Liabilities', type: 'LIABILITY', subtype: 'OTHER_CURRENT_LIABILITY' },
  {
    code: '2310',
    name: 'Tips Payable',
    type: 'LIABILITY',
    subtype: 'OTHER_CURRENT_LIABILITY',
    systemKey: 'TIP_LIABILITY',
    description: 'Tips collected at the till, owed to staff — not sales revenue.',
  },
  {
    code: '2320',
    name: 'Unearned Revenue',
    type: 'LIABILITY',
    subtype: 'OTHER_CURRENT_LIABILITY',
    systemKey: 'UNEARNED_REVENUE',
    description:
      'Customer payments/invoices for service periods not yet delivered — subscriptions, rentals, memberships.',
  },
  { code: '2500', name: 'Long-Term Loans', type: 'LIABILITY', subtype: 'LONG_TERM_LIABILITY' },
  {
    code: '1350',
    name: 'Contract Retention Receivable',
    type: 'ASSET',
    subtype: 'OTHER_CURRENT_ASSET',
    systemKey: 'RETENTION_RECEIVABLE',
    description:
      'Progress billing retention held by the customer until release — not yet due in AR.',
  },

  // --- Equity -------------------------------------------------------------
  { code: '3000', name: "Owner's Capital", type: 'EQUITY', subtype: 'OWNERS_EQUITY' },
  { code: '3100', name: "Owner's Drawings", type: 'EQUITY', subtype: 'DRAWINGS' },
  {
    code: '3200',
    name: 'Opening Balance Equity',
    type: 'EQUITY',
    subtype: 'OPENING_BALANCE_EQUITY',
    systemKey: 'OPENING_BALANCE_EQUITY',
    description:
      'The other side of every opening balance. Should be cleared to capital once the books are set up.',
  },
  {
    code: '3900',
    name: 'Retained Earnings',
    type: 'EQUITY',
    subtype: 'RETAINED_EARNINGS',
    systemKey: 'RETAINED_EARNINGS',
    description: 'Accumulated profit from closed fiscal years.',
  },

  // --- Revenue ------------------------------------------------------------
  { code: '4000', name: 'Sales — Plastic Products', type: 'REVENUE', subtype: 'INCOME' },
  { code: '4100', name: 'Service Income', type: 'REVENUE', subtype: 'INCOME' },
  {
    code: '4200',
    name: 'Uncategorised Income',
    type: 'REVENUE',
    subtype: 'INCOME',
    systemKey: 'UNCATEGORISED_INCOME',
    description: 'Holding account for income that has not been classified yet.',
  },
  {
    code: '4900',
    name: 'Sales Discounts',
    type: 'REVENUE',
    subtype: 'SALES_DISCOUNTS',
    description: 'Contra-revenue. Carries a debit balance.',
  },
  { code: '4950', name: 'Other Income', type: 'REVENUE', subtype: 'OTHER_INCOME' },
  {
    code: '4960',
    name: 'Cash Over (POS)',
    type: 'REVENUE',
    subtype: 'OTHER_INCOME',
    systemKey: 'POS_CASH_OVER',
    description: 'Drawer cash counted above expected when a POS session closes.',
  },

  // --- Cost of goods sold -------------------------------------------------
  {
    code: '5000',
    name: 'Cost of Goods Sold',
    type: 'COGS',
    subtype: 'COST_OF_GOODS_SOLD',
    systemKey: 'COGS',
    description: 'Cost of stock sold, posted in the same journal as the sale.',
  },
  { code: '5100', name: 'Freight & Duty — Inbound', type: 'COGS', subtype: 'COST_OF_GOODS_SOLD' },
  {
    code: '5200',
    name: 'Inventory Shrinkage',
    type: 'COGS',
    subtype: 'COST_OF_GOODS_SOLD',
    systemKey: 'INVENTORY_SHRINKAGE',
    description: 'Stock written off through counts and adjustments.',
  },

  // --- Operating expenses -------------------------------------------------
  { code: '6000', name: 'Salaries & Wages', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6100', name: 'Rent', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6200', name: 'Utilities', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6300', name: 'Repairs & Maintenance', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6400', name: 'Office Supplies', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6500', name: 'Transport & Fuel', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6600', name: 'Marketing & Advertising', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6700', name: 'Professional Fees', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6800', name: 'Bank Charges', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6900', name: 'Bad Debt Expense', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  {
    code: '6910',
    name: 'Cash Short (POS)',
    type: 'EXPENSE',
    subtype: 'OPERATING_EXPENSE',
    systemKey: 'POS_CASH_SHORT',
    description: 'Drawer cash counted below expected when a POS session closes.',
  },
  {
    code: '6950',
    name: 'Uncategorised Expense',
    type: 'EXPENSE',
    subtype: 'OPERATING_EXPENSE',
    systemKey: 'UNCATEGORISED_EXPENSE',
    description: 'Holding account for spending that has not been classified yet.',
  },

  // --- Other ---------------------------------------------------------------
  { code: '7000', name: 'Depreciation Expense', type: 'EXPENSE', subtype: 'DEPRECIATION' },
  { code: '7500', name: 'Interest Expense', type: 'EXPENSE', subtype: 'OTHER_EXPENSE' },
  {
    code: '7600',
    name: 'Exchange Gain / Loss',
    type: 'EXPENSE',
    subtype: 'OTHER_EXPENSE',
    systemKey: 'EXCHANGE_GAIN_LOSS',
    description: 'Unused until multi-currency is switched on.',
  },
  {
    code: '7700',
    name: 'Rounding Difference',
    type: 'EXPENSE',
    subtype: 'OTHER_EXPENSE',
    systemKey: 'ROUNDING_DIFFERENCE',
    description:
      'Absorbs the cent a document can lose between its rounded lines and its rounded total.',
  },
]

const ORIGINAL_NAMES = new Set(DEFAULT_CHART.map((account) => account.name))
const ORIGINAL_KEYS = new Set(
  DEFAULT_CHART.flatMap((account) => (account.systemKey ? [account.systemKey] : [])),
)

/**
 * Accounts a company already added for itself stay in the books, but they are not
 * part of the chart list. A new company starts from the original chart and anything
 * it adds after this moment is its own, so it stays on the list.
 */
export const CHART_LIST_SINCE = new Date('2026-11-13T13:50:00.000Z')

export function isOriginalChartAccount(account: {
  name: string
  systemKey: SystemAccountKey | null
}): boolean {
  return ORIGINAL_NAMES.has(account.name) || (account.systemKey != null && ORIGINAL_KEYS.has(account.systemKey))
}

export function listedOnOriginalChart(account: {
  name: string
  systemKey: SystemAccountKey | null
  createdAt: Date
}): boolean {
  if (isOriginalChartAccount(account)) return true
  return account.createdAt.getTime() >= CHART_LIST_SINCE.getTime()
}

/**
 * Install the default chart for an organisation that has none.
 *
 * Idempotent and additive: it skips any code that already exists, so it can be
 * re-run to add system accounts introduced by a later release without disturbing
 * a chart the business has since edited.
 */
export async function seedChartOfAccounts(
  tx: Tx,
  orgId: string,
): Promise<{ created: number; skipped: number }> {
  const existing = await tx.ledgerAccount.findMany({
    where: { orgId },
    select: { code: true, systemKey: true },
  })

  const usedCodes = new Set(existing.map((account) => account.code))
  const usedKeys = new Set(existing.map((account) => account.systemKey).filter(Boolean))

  const toCreate = DEFAULT_CHART.filter(
    (account) =>
      !usedCodes.has(account.code) && (!account.systemKey || !usedKeys.has(account.systemKey)),
  )

  if (toCreate.length > 0) {
    await tx.ledgerAccount.createMany({
      data: toCreate.map((account) => ({
        orgId,
        code: account.code,
        name: account.name,
        description: account.description ?? null,
        type: account.type,
        subtype: account.subtype,
        systemKey: account.systemKey ?? null,
        isSystem: Boolean(account.systemKey),
      })),
      skipDuplicates: true,
    })
  }

  return { created: toCreate.length, skipped: DEFAULT_CHART.length - toCreate.length }
}

/** Look up a system account, failing loudly rather than posting somewhere plausible. */
export async function systemAccountId(
  tx: Tx,
  orgId: string,
  key: SystemAccountKey,
): Promise<string> {
  const account = await tx.ledgerAccount.findUnique({
    where: { orgId_systemKey: { orgId, systemKey: key } },
    select: { id: true },
  })

  if (!account) {
    throw new Error(
      `The ${key} system account is missing. Run the chart of accounts setup before posting.`,
    )
  }
  return account.id
}

type CogsCandidate = {
  id: string
  code: string
  name: string
  type: AccountType
  isActive: boolean
  parentId: string | null
  _count: { children: number }
}

/**
 * QuickBooks-style COGS: main headings are for reporting only. Posting goes to a
 * leaf. Prefer the item's mapped account; if that is a heading with exactly one
 * postable descendant, use it; otherwise fall back to the system COGS binding
 * with the same rules.
 */
export async function resolvePostableCogsAccountId(
  tx: Tx,
  orgId: string,
  preferredId: string | null | undefined,
): Promise<string> {
  if (preferredId) {
    const preferred = await loadCogsCandidate(tx, orgId, preferredId)
    if (preferred) return resolveCogsCandidate(tx, orgId, preferred)
  }

  const system = await tx.ledgerAccount.findUnique({
    where: { orgId_systemKey: { orgId, systemKey: 'COGS' } },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      isActive: true,
      parentId: true,
      _count: { select: { children: true } },
    },
  })

  if (!system) {
    throw validation('There is no Cost of Goods Sold account on the chart.', {
      cogsAccountId: ['Set up the Cost of Goods Sold account under Settings → Default accounts'],
    })
  }

  return resolveCogsCandidate(tx, orgId, system)
}

async function loadCogsCandidate(
  tx: Tx,
  orgId: string,
  id: string,
): Promise<CogsCandidate | null> {
  return tx.ledgerAccount.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      isActive: true,
      parentId: true,
      _count: { select: { children: true } },
    },
  })
}

async function resolveCogsCandidate(
  tx: Tx,
  orgId: string,
  account: CogsCandidate,
): Promise<string> {
  if (!account.isActive) {
    throw validation(`Account ${account.code} ${account.name} is archived and cannot receive cost of sales.`, {
      cogsAccountId: ['Choose an active Cost of Goods Sold account'],
    })
  }
  if (account.type !== 'COGS') {
    throw validation(
      `"${account.name}" is not a cost of goods sold account, so cost of sales cannot be posted to it.`,
      { cogsAccountId: ['Choose a cost of goods sold account'] },
    )
  }
  if (account._count.children === 0) return account.id

  const leaves = await postableCogsDescendants(tx, orgId, account.id)
  if (leaves.length === 1) return leaves[0]!.id
  if (leaves.length === 0) {
    throw validation(
      `Account ${account.code} ${account.name} is a grouping heading with no postable sub-account. Add a Cost of Goods Sold detail account under it.`,
      { cogsAccountId: ['Add or choose a Cost of Goods Sold sub-account'] },
    )
  }

  throw validation(
    `Account ${account.code} ${account.name} is a grouping heading with more than one sub-account. Map this product to a postable Cost of Goods Sold sub-account.`,
    { cogsAccountId: ['Choose a Cost of Goods Sold sub-account'] },
  )
}

/** Active COGS leaves under a heading (any depth). */
async function postableCogsDescendants(
  tx: Tx,
  orgId: string,
  rootId: string,
): Promise<{ id: string; code: string; name: string }[]> {
  const accounts = await tx.ledgerAccount.findMany({
    where: { orgId, isActive: true, type: 'COGS' },
    select: {
      id: true,
      code: true,
      name: true,
      parentId: true,
      _count: { select: { children: true } },
    },
  })

  const childrenByParent = new Map<string, string[]>()
  for (const account of accounts) {
    if (!account.parentId) continue
    const list = childrenByParent.get(account.parentId) ?? []
    list.push(account.id)
    childrenByParent.set(account.parentId, list)
  }

  const underRoot = new Set<string>()
  const stack = [...(childrenByParent.get(rootId) ?? [])]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (underRoot.has(id)) continue
    underRoot.add(id)
    for (const childId of childrenByParent.get(id) ?? []) stack.push(childId)
  }

  return accounts
    .filter((account) => underRoot.has(account.id) && account._count.children === 0)
    .map((account) => ({ id: account.id, code: account.code, name: account.name }))
    .sort((a, b) => a.code.localeCompare(b.code))
}
