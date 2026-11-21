import 'server-only'

import { addMonths, fiscalYearOf, fiscalYearRange, today, toDate, type CalendarDate } from '@/lib/date'
import {
  ownedPortfolioKpis,
  portfolioCsv,
  portfolioKpiStrip,
  portfolioRollup,
  portfolioRowsFromConsol,
} from '@/lib/erp/portfolio'
import { type ConsolCompanyRow } from '@/lib/erp/consolidation-ownership'
import { Decimal } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { consolidatedGroup } from '@/server/reports/consolidation'

export async function portfolioReport(ctx: OrgContext) {
  const consol = await consolidatedGroup(ctx)
  const names = new Map(consol.companies.map((row) => [row.orgId, row.name]))
  const rollupInput: ConsolCompanyRow[] = consol.companies.map((row) => ({
    orgId: row.orgId,
    isParent: row.isParent,
    ownershipPercent: row.ownershipPercent,
    income: row.income,
    expense: row.expense,
    net: row.net,
    assets: row.assets,
    liabilities: row.liabilities,
    equity: row.equity,
  }))
  const rollup = portfolioRollup(rollupInput)
  const subsidiaries = portfolioRowsFromConsol(rollupInput, names)
  const asOf = today(ctx.organization.timeZone)
  const kpis = await portfolioKpiStripForGroup(ctx, consol.companies, asOf)
  return {
    parentId: consol.parentId,
    subsidiaries,
    rollup: {
      net: rollup.net.toFixed(4),
      nci: rollup.nci.toFixed(4),
    },
    kpis,
    csv: portfolioCsv(subsidiaries),
  }
}

async function portfolioKpiStripForGroup(
  ctx: OrgContext,
  companies: { orgId: string; isParent: boolean; ownershipPercent: Decimal }[],
  asOf: CalendarDate,
) {
  const fyStart = {
    month: ctx.organization.fiscalYearStartMonth,
    day: ctx.organization.fiscalYearStartDay,
  }
  const currentYear = fiscalYearOf(asOf, fyStart)
  const currentRange = fiscalYearRange(currentYear, fyStart)
  const priorAsOf = addMonths(asOf, -12)
  const priorYear = fiscalYearOf(priorAsOf, fyStart)
  const priorRange = fiscalYearRange(priorYear, fyStart)

  const current = await ownedKpisAt(companies, asOf, currentRange.start)
  const prior = await ownedKpisAt(companies, priorAsOf, priorRange.start)
  return portfolioKpiStrip(current, prior)
}

async function ownedKpisAt(
  companies: { orgId: string; isParent: boolean; ownershipPercent: Decimal }[],
  asOf: CalendarDate,
  yearStart: CalendarDate,
) {
  const rows = []
  for (const company of companies) {
    const totals = await companyKpiTotals(company.orgId, asOf, yearStart)
    rows.push({
      isParent: company.isParent,
      ownershipPercent: company.ownershipPercent,
      ...totals,
    })
  }
  return ownedPortfolioKpis(rows)
}

async function companyKpiTotals(orgId: string, asOf: CalendarDate, yearStart: CalendarDate) {
  const asOfDate = toDate(asOf)
  const yearStartDate = toDate(yearStart)
  const [bs] = await db.$queryRaw<{ cash: string; ar: string; stock: string }[]>`
    SELECT
      COALESCE(SUM(CASE WHEN a.subtype IN ('BANK', 'UNDEPOSITED_FUNDS') THEN l.debit - l.credit ELSE 0 END), 0) AS cash,
      COALESCE(SUM(CASE WHEN a.subtype = 'ACCOUNTS_RECEIVABLE' THEN l.debit - l.credit ELSE 0 END), 0) AS ar,
      COALESCE(SUM(CASE WHEN a.subtype = 'INVENTORY' THEN l.debit - l.credit ELSE 0 END), 0) AS stock
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
      JOIN ledger_accounts a ON a.id = l."accountId"
     WHERE l."orgId" = ${orgId}
       AND l."journalDate" <= ${asOfDate}
       AND COALESCE(j.memo, '') NOT LIKE '[IC]%'
  `
  const [pl] = await db.$queryRaw<{ income: string; expense: string }[]>`
    SELECT
      COALESCE(SUM(CASE WHEN a.type = 'INCOME' THEN l.credit - l.debit ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN a.type IN ('EXPENSE', 'COST_OF_GOODS_SOLD', 'OTHER_EXPENSE')
        THEN l.debit - l.credit ELSE 0 END), 0) AS expense
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
      JOIN ledger_accounts a ON a.id = l."accountId"
     WHERE l."orgId" = ${orgId}
       AND l."journalDate" >= ${yearStartDate}
       AND l."journalDate" <= ${asOfDate}
       AND COALESCE(j.memo, '') NOT LIKE '[IC]%'
  `
  const income = new Decimal(pl?.income ?? 0)
  const expense = new Decimal(pl?.expense ?? 0)
  return {
    cash: new Decimal(bs?.cash ?? 0),
    ar: new Decimal(bs?.ar ?? 0),
    stock: new Decimal(bs?.stock ?? 0),
    ni: income.minus(expense),
  }
}