/**
 * Create / reset company "Markan Sameyo" with the clean standard chart of
 * accounts (same numbering as QuickBooks / Odoo-style defaults used by this app).
 */
process.loadEnvFile('.env')
const { PrismaPg } = await import('@prisma/adapter-pg')
const { PrismaClient } = await import('@prisma/client')
const { randomBytes } = await import('node:crypto')

const NAME = 'Markan Sameyo'

/** Standard chart — mirrors server/accounting/chart-of-accounts.ts DEFAULT_CHART */
const DEFAULT_CHART = [
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
  { code: '2500', name: 'Long-Term Loans', type: 'LIABILITY', subtype: 'LONG_TERM_LIABILITY' },
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
  { code: '4000', name: 'Sales', type: 'REVENUE', subtype: 'INCOME' },
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
  {
    code: '5000',
    name: 'Cost of Goods Sold',
    type: 'EXPENSE',
    subtype: 'COST_OF_GOODS_SOLD',
    systemKey: 'COGS',
    description: 'Cost of stock sold, posted in the same journal as the sale.',
  },
  { code: '5100', name: 'Freight & Duty — Inbound', type: 'EXPENSE', subtype: 'COST_OF_GOODS_SOLD' },
  {
    code: '5200',
    name: 'Inventory Shrinkage',
    type: 'EXPENSE',
    subtype: 'COST_OF_GOODS_SOLD',
    systemKey: 'INVENTORY_SHRINKAGE',
    description: 'Stock written off through counts and adjustments.',
  },
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

const DEFAULT_PREFIX = {
  JOURNAL: 'JE-',
  INVOICE: 'INV-',
  ESTIMATE: 'EST-',
  QUOTATION: 'QUO-',
  SALES_ORDER: 'SO-',
  SALES_RECEIPT: 'SR-',
  CREDIT_MEMO: 'CM-',
  CUSTOMER_PAYMENT: 'PMT-',
  REFUND_RECEIPT: 'RFD-',
  BILL: 'BILL-',
  BILL_PAYMENT: 'BP-',
  EXPENSE: 'EXP-',
  VENDOR_CREDIT: 'VC-',
  PURCHASE_ORDER: 'PO-',
  TRANSFER: 'TRF-',
  DEPOSIT: 'DEP-',
  INVENTORY_ADJUSTMENT: 'ADJ-',
  STORE_TRANSFER: 'STX-',
  STORE_TICKET: 'TKT-',
  DELIVERY_NOTE: 'DN-',
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const owner = await db.user.findFirst({
  where: { isSystemOwner: true },
  select: { id: true, email: true },
})
if (!owner) {
  console.error('No system owner.')
  process.exit(1)
}

async function installStandardChart(tx, orgId) {
  // Hierarchy off first so child deletes are not blocked.
  await tx.ledgerAccount.updateMany({ where: { orgId }, data: { parentId: null } })

  // System accounts cannot be deleted or have their role changed — keep them,
  // drop every custom/extra account, then fill any missing standard rows.
  await tx.ledgerAccount.deleteMany({ where: { orgId, isSystem: false } })

  const existing = await tx.ledgerAccount.findMany({
    where: { orgId },
    select: { id: true, code: true, systemKey: true },
  })
  const byKey = new Map(existing.filter((a) => a.systemKey).map((a) => [a.systemKey, a]))
  const usedCodes = new Set(existing.map((a) => a.code))

  for (const account of DEFAULT_CHART) {
    if (account.systemKey && byKey.has(account.systemKey)) {
      const row = byKey.get(account.systemKey)
      await tx.ledgerAccount.update({
        where: { id: row.id },
        data: {
          code: account.code,
          name: account.name,
          description: account.description ?? null,
          type: account.type,
          subtype: account.subtype,
          isActive: true,
        },
      })
      usedCodes.delete(row.code)
      usedCodes.add(account.code)
      continue
    }

    if (usedCodes.has(account.code)) continue

    await tx.ledgerAccount.create({
      data: {
        id: `c${randomBytes(12).toString('hex')}`,
        orgId,
        code: account.code,
        name: account.name,
        description: account.description ?? null,
        type: account.type,
        subtype: account.subtype,
        systemKey: account.systemKey ?? null,
        isSystem: Boolean(account.systemKey),
        isActive: true,
      },
    })
    usedCodes.add(account.code)
  }
}

async function ensureSequences(tx, orgId) {
  await tx.documentSequence.createMany({
    data: Object.entries(DEFAULT_PREFIX).map(([docType, prefix]) => ({
      orgId,
      docType,
      prefix,
      nextNumber: 1,
      padding: 5,
    })),
    skipDuplicates: true,
  })
}

let existing = await db.organization.findFirst({
  where: { name: { equals: NAME, mode: 'insensitive' } },
  select: { id: true, name: true, baseCurrency: true },
})

let status = 'created'

if (existing) {
  status = 'reset'
  await db.$transaction(
    async (tx) => {
      await installStandardChart(tx, existing.id)
      await ensureSequences(tx, existing.id)

      const membership = await tx.membership.findUnique({
        where: { orgId_userId: { orgId: existing.id, userId: owner.id } },
        select: { id: true },
      })
      if (!membership) {
        await tx.membership.create({
          data: {
            orgId: existing.id,
            userId: owner.id,
            role: 'OWNER',
            status: 'ACTIVE',
            acceptedAt: new Date(),
          },
        })
      }

      await tx.auditLog.create({
        data: {
          orgId: existing.id,
          actorId: owner.id,
          entity: 'Organization',
          entityId: existing.id,
          action: 'UPDATE',
          after: { name: existing.name, via: 'seed-markan-sameyo', chart: 'standard-default' },
        },
      })
    },
    { maxWait: 20_000, timeout: 120_000 },
  )
} else {
  const createdId = `c${randomBytes(12).toString('hex')}`
  await db.$transaction(
    async (tx) => {
      await tx.organization.create({
        data: {
          id: createdId,
          name: NAME,
          baseCurrency: 'USD',
          fiscalYearStartMonth: 1,
          timeZone: 'Africa/Mogadishu',
        },
      })

      await tx.membership.create({
        data: {
          orgId: createdId,
          userId: owner.id,
          role: 'OWNER',
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      })

      await ensureSequences(tx, createdId)
      await installStandardChart(tx, createdId)

      await tx.auditLog.create({
        data: {
          orgId: createdId,
          actorId: owner.id,
          entity: 'Organization',
          entityId: createdId,
          action: 'CREATE',
          after: { name: NAME, via: 'seed-markan-sameyo', chart: 'standard-default' },
        },
      })
    },
    { maxWait: 20_000, timeout: 120_000 },
  )

  existing = { id: createdId, name: NAME, baseCurrency: 'USD' }
}

const accounts = await db.ledgerAccount.findMany({
  where: { orgId: existing.id },
  select: { code: true, name: true, type: true, systemKey: true },
  orderBy: { code: 'asc' },
})
const sequences = await db.documentSequence.count({ where: { orgId: existing.id } })

console.log(
  JSON.stringify(
    {
      status,
      company: existing,
      owner: owner.email,
      accountCount: accounts.length,
      sequenceCount: sequences,
      systemKeys: accounts.filter((a) => a.systemKey).map((a) => a.systemKey),
      accounts,
    },
    null,
    2,
  ),
)

await db.$disconnect()
