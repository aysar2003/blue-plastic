import { TABLE_REPORTS, tableReport } from '../server/reports/catalogue.ts'
import { db } from '../server/db.ts'
import { today } from '../lib/date.ts'
import { salesByCustomer, salesByItem } from '../server/reports/business.ts'
import { balanceSheet, profitAndLoss } from '../server/reports/statements.ts'
import { endOfMonth } from '../lib/date.ts'

const keys = [
  'sales-by-customer-item',
  'open-sales-orders',
  'open-estimates',
  'purchases-by-item-detail',
  'sales-by-sales-person',
  'expenses-by-vendor-detail',
  'inventory-stock-status',
  'inventory-valuation-detail',
  'inventory-days-on-hand',
  'uncleared-bank-lines',
  'voided-transactions',
  'budget-vs-actual',
]

const missing = keys.filter((k) => !tableReport(k))
console.log('catalogue_total', TABLE_REPORTS.length)
console.log('missing', missing.length ? missing.join(',') : 'none')

const org = await db.organization.findFirst({
  select: {
    id: true,
    name: true,
    timeZone: true,
    baseCurrency: true,
    fiscalYearStartMonth: true,
  },
})
if (!org) {
  console.log('no_org')
  process.exit(1)
}
console.log('org', org.name)

const asOf = today(org.timeZone)
// Prefer year-to-date so empty-state and populated rows both get exercised.
const range = { from: `${asOf.slice(0, 4)}-01-01`, to: asOf }
const ctx = {
  orgId: org.id,
  userId: 'smoke',
  permissions: new Set(['report:read']),
  organization: org,
}

const results: Record<string, unknown>[] = []
for (const key of keys) {
  const def = tableReport(key)
  if (!def) continue
  const t0 = Date.now()
  try {
    const table = await def.build({
      ctx: ctx as never,
      range,
      asOf,
      filters: {},
    })
    const groupRows = table.rows.filter((row) => row.emphasis).length
    results.push({
      key,
      ok: true,
      rows: table.rows.length,
      groups: groupRows,
      cols: table.columns.length,
      ms: Date.now() - t0,
      empty: table.rows.length === 0 ? (table.empty ?? 'empty') : null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    results.push({ key, ok: false, err: message.slice(0, 240), ms: Date.now() - t0 })
  }
}

const customer = await db.customer.findFirst({
  where: { orgId: org.id, isActive: true },
  select: { id: true },
})
const item = await db.item.findFirst({
  where: { orgId: org.id, deletedAt: null },
  select: { id: true },
})

const tFilter = Date.now()
try {
  const [byCustomer, byItem] = await Promise.all([
    salesByCustomer(org.id, range, { customerId: customer?.id }),
    salesByItem(org.id, range, { itemId: item?.id, customerId: customer?.id }),
  ])
  results.push({
    key: 'summary-filters',
    ok: true,
    customerRows: byCustomer.rows.length,
    itemRows: byItem.rows.length,
    ms: Date.now() - tFilter,
  })
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  results.push({ key: 'summary-filters', ok: false, err: message.slice(0, 240), ms: Date.now() - tFilter })
}

const year = asOf.slice(0, 4)
const tMonth = Date.now()
try {
  const months = await Promise.all(
    Array.from({ length: 12 }, (_, index) => {
      const from = `${year}-${String(index + 1).padStart(2, '0')}-01`
      return profitAndLoss(org.id, { from, to: endOfMonth(from), basis: 'accrual' })
    }),
  )
  results.push({
    key: 'pl-by-month',
    ok: true,
    months: months.length,
    netSample: months[0]?.netIncome.toString(),
    ms: Date.now() - tMonth,
  })
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  results.push({ key: 'pl-by-month', ok: false, err: message.slice(0, 240), ms: Date.now() - tMonth })
}

const tBs = Date.now()
try {
  const prior = `${Number(year) - 1}-12-31`
  const sheet = await balanceSheet(org.id, asOf, {
    basis: 'accrual',
    comparisonAsOf: prior,
  })
  results.push({
    key: 'balance-sheet-compare',
    ok: true,
    balanced: sheet.balanced,
    hasComparison: Boolean(sheet.comparison),
    sections: sheet.sections.length,
    ms: Date.now() - tBs,
  })
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  results.push({ key: 'balance-sheet-compare', ok: false, err: message.slice(0, 240), ms: Date.now() - tBs })
}

console.log(JSON.stringify(results, null, 2))
const failed = results.filter((row) => row.ok === false)
await db.$disconnect()
process.exit(failed.length ? 1 : 0)
