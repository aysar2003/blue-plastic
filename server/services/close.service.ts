import 'server-only'

import type { AccountType } from '@prisma/client'

import type { ClosingAccountKind, ClosingAccountRow, ClosingAccountsBoard } from '@/lib/closing-accounts'
import { toCalendarDate, today, type CalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import { closeYear, closingPreview, reopenYear, type ClosingPreview } from '@/server/accounting/close'
import { closeChecklist } from '@/server/accounting/close-checklist'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound } from '@/server/errors'

export { closeChecklist }

function kindFromType(type: AccountType): ClosingAccountKind {
  if (type === 'REVENUE') return 'REVENUE'
  if (type === 'COGS') return 'COGS'
  if (type === 'EXPENSE') return 'EXPENSE'
  return 'EQUITY'
}

function boardFromPreview(
  preview: ClosingPreview,
  accountTypes: Map<string, AccountType>,
  currency: string,
  retainedEarningsCode: string,
): ClosingAccountsBoard {
  const rows: ClosingAccountRow[] = preview.lines.map((line) => {
    const balance = new Decimal(line.balance)
    const closeDebit = balance.isNegative() ? balance.negated() : ZERO
    const closeCredit = balance.isPositive() ? balance : ZERO
    return {
      accountId: line.accountId,
      code: line.code,
      name: line.name,
      kind: kindFromType(accountTypes.get(line.accountId) ?? 'EXPENSE'),
      balanceBefore: balance.toFixed(4),
      closeDebit: closeDebit.toFixed(4),
      closeCredit: closeCredit.toFixed(4),
    }
  })

  if (!preview.netIncome.equals(0)) {
    rows.push({
      accountId: preview.retainedEarningsAccountId,
      code: retainedEarningsCode,
      name: preview.retainedEarningsName,
      kind: 'EQUITY',
      balanceBefore: '',
      closeDebit: preview.netIncome.isNegative() ? preview.netIncome.negated().toFixed(4) : '0',
      closeCredit: preview.netIncome.isPositive() ? preview.netIncome.toFixed(4) : '0',
    })
  }

  return {
    fiscalYearId: preview.fiscalYearId,
    year: preview.year,
    mode: 'preview',
    journalNumber: null,
    netIncome: preview.netIncome.toFixed(4),
    retainedEarningsName: preview.retainedEarningsName,
    currency,
    rows,
  }
}

/**
 * Closing accounts for every year the user can inspect: a finished year still
 * open (preview), plus every year that already posted a closing journal.
 */
export async function listClosingAccountsBoards(ctx: OrgContext): Promise<ClosingAccountsBoard[]> {
  const years = await db.fiscalYear.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { year: 'desc' },
    select: {
      id: true,
      year: true,
      endDate: true,
      status: true,
      closingJournalId: true,
    },
  })

  const currency = ctx.organization.baseCurrency
  const now = today(ctx.organization.timeZone)
  const boards: ClosingAccountsBoard[] = []

  for (const year of years) {
    if (year.closingJournalId) {
      const journal = await db.journal.findFirst({
        where: { id: year.closingJournalId, orgId: ctx.orgId },
        select: {
          journalNumber: true,
          lines: {
            orderBy: { lineNumber: 'asc' },
            select: {
              debit: true,
              credit: true,
              account: {
                select: { id: true, code: true, name: true, type: true, systemKey: true },
              },
            },
          },
        },
      })
      if (!journal) continue

      const rows: ClosingAccountRow[] = journal.lines.map((line) => {
        const isRetained = line.account.systemKey === 'RETAINED_EARNINGS'
        return {
          accountId: line.account.id,
          code: line.account.code,
          name: line.account.name,
          kind: isRetained ? 'EQUITY' : kindFromType(line.account.type),
          balanceBefore: '',
          closeDebit: new Decimal(line.debit.toString()).toFixed(4),
          closeCredit: new Decimal(line.credit.toString()).toFixed(4),
        }
      })
      const retained = rows.find((row) => row.kind === 'EQUITY')
      const netIncome = retained
        ? new Decimal(retained.closeCredit).minus(retained.closeDebit)
        : ZERO
      boards.push({
        fiscalYearId: year.id,
        year: year.year,
        mode: 'posted',
        journalNumber: journal.journalNumber,
        netIncome: netIncome.toFixed(4),
        retainedEarningsName: retained?.name ?? 'Retained Earnings',
        currency,
        rows,
      })
      continue
    }

    if (year.status !== 'LOCKED' && toCalendarDate(year.endDate) < now) {
      try {
        const preview = await previewClose(ctx, year.id)
        const accountIds = [
          ...preview.lines.map((line) => line.accountId),
          preview.retainedEarningsAccountId,
        ]
        const accounts = await db.ledgerAccount.findMany({
          where: { orgId: ctx.orgId, id: { in: accountIds } },
          select: { id: true, type: true, code: true },
        })
        const byId = new Map(accounts.map((account) => [account.id, account]))
        boards.push(
          boardFromPreview(
            preview,
            new Map(accounts.map((account) => [account.id, account.type])),
            currency,
            byId.get(preview.retainedEarningsAccountId)?.code ?? '3900',
          ),
        )
      } catch {
        // Empty year or missing Retained Earnings — skip the board.
      }
    }
  }

  return boards
}

/** The closing entry a year-end would post, without posting it. */
export async function previewClose(ctx: OrgContext, fiscalYearId: string): Promise<ClosingPreview> {
  return db.$transaction((tx) => closingPreview(tx, ctx, fiscalYearId))
}

export async function closeFiscalYear(ctx: OrgContext, fiscalYearId: string) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const result = await closeYear(tx, ctx, fiscalYearId)

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'FiscalYear',
        entityId: fiscalYearId,
        action: 'CLOSE_PERIOD',
        after: {
          year: result.preview.year,
          netIncome: result.preview.netIncome.toString(),
          closingJournal: result.journal?.journalNumber ?? null,
          periodsLocked: result.periodsLocked,
        },
      },
      meta,
    )

    return {
      year: result.preview.year,
      journalNumber: result.journal?.journalNumber ?? null,
      netIncome: result.preview.netIncome.toString(),
    }
  })
}

export async function reopenFiscalYear(ctx: OrgContext, fiscalYearId: string, reason: string) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const result = await reopenYear(tx, ctx, fiscalYearId, reason)

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'FiscalYear',
        entityId: fiscalYearId,
        action: 'REOPEN_PERIOD',
        after: { reversalJournal: result.reversal?.journalNumber ?? null, reason },
      },
      meta,
    )

    return { reversalJournal: result.reversal?.journalNumber ?? null }
  })
}

export type ClosePeriodTarget = {
  id: string
  label: string
  from: CalendarDate
  to: CalendarDate
}

/**
 * The earliest period still open — the only one that can be closed next, since
 * periods close in order.
 */
export async function nextPeriodToClose(ctx: OrgContext): Promise<ClosePeriodTarget | null> {
  const period = await db.accountingPeriod.findFirst({
    where: { orgId: ctx.orgId, status: 'OPEN' },
    orderBy: { startDate: 'asc' },
    select: {
      id: true,
      periodNumber: true,
      startDate: true,
      endDate: true,
      fiscalYear: { select: { year: true } },
    },
  })
  if (!period) return null

  return {
    id: period.id,
    label:
      period.periodNumber === 0
        ? `Opening balances, fiscal year ${period.fiscalYear.year}`
        : period.startDate.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    from: toCalendarDate(period.startDate),
    to: toCalendarDate(period.endDate),
  }
}

export async function periodById(ctx: OrgContext, periodId: string): Promise<ClosePeriodTarget> {
  const period = await db.accountingPeriod.findFirst({
    where: { id: periodId, orgId: ctx.orgId },
    select: {
      id: true,
      periodNumber: true,
      startDate: true,
      endDate: true,
      fiscalYear: { select: { year: true } },
    },
  })
  if (!period) throw notFound('Accounting period')

  return {
    id: period.id,
    label:
      period.periodNumber === 0
        ? `Opening balances, fiscal year ${period.fiscalYear.year}`
        : period.startDate.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    from: toCalendarDate(period.startDate),
    to: toCalendarDate(period.endDate),
  }
}
