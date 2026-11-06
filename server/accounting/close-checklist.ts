import 'server-only'

import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { stockAgreesWithLedger } from './inventory'

/**
 * The month-end checklist.
 *
 * Everything here is a question a bookkeeper would otherwise have to remember to
 * ask before closing a month. None of it blocks the close — a soft close is
 * reversible and refusing it would only teach people to close late — but a month
 * closed over an unreconciled bank account is a month whose figures will be
 * argued about later, so the questions are asked while they are still cheap to
 * answer.
 *
 * Severity is the whole design:
 *
 * - `blocked`  the books disagree with themselves. Do not close.
 * - `warning`  something is unfinished. Closing is a choice, not an accident.
 * - `ok`       nothing to do.
 */
export type CheckSeverity = 'ok' | 'warning' | 'blocked'

export type CloseCheck = {
  key: string
  label: string
  detail: string
  severity: CheckSeverity
  href?: string
  /** Plain steps shown when the check is warning or blocked. */
  howTo?: string
  count?: number
  amount?: Decimal
}

export type CloseChecklist = {
  from: CalendarDate
  to: CalendarDate
  checks: CloseCheck[]
  blocked: boolean
  warnings: number
}

export async function closeChecklist(
  ctx: OrgContext,
  range: { from: CalendarDate; to: CalendarDate },
  options: { client?: Tx } = {},
): Promise<CloseChecklist> {
  const client = options.client ?? db
  const from = toDate(range.from)
  const to = toDate(range.to)
  const currency = ctx.organization.baseCurrency

  const checks: CloseCheck[] = []

  // --- The books agree with themselves -------------------------------------

  const [balance] = await client.$queryRaw<{ debit: string; credit: string }[]>`
    SELECT COALESCE(SUM(l.debit), 0) AS debit, COALESCE(SUM(l.credit), 0) AS credit
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
     WHERE l."orgId" = ${ctx.orgId}
       AND l."journalDate" <= ${to}
  `
  const outOfBalance = new Decimal(balance?.debit ?? 0).minus(balance?.credit ?? 0)
  checks.push({
    key: 'trial-balance',
    label: 'Debits equal credits',
    detail: outOfBalance.isZero()
      ? 'The ledger balances to the end of the period.'
      : `The ledger is out of balance by ${outOfBalance.toFixed(2)} ${currency}. This should be impossible.`,
    severity: outOfBalance.isZero() ? 'ok' : 'blocked',
    href: '/reports/trial-balance',
    howTo:
      'Open Trial Balance. Find the account or journal that made debits ≠ credits, reverse the bad entry, and re-post a correct one. Do not close until this is zero.',
    amount: outOfBalance,
  })

  const [receivables] = await client.$queryRaw<{ control: string; subsidiary: string }[]>`
    WITH control AS (
      SELECT COALESCE(SUM(l.debit - l.credit), 0) AS amount
        FROM journal_lines l
        JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
        JOIN ledger_accounts a ON a.id = l."accountId"
       WHERE l."orgId" = ${ctx.orgId}
         AND a."systemKey" = 'ACCOUNTS_RECEIVABLE'
         AND l."journalDate" <= ${to}
    ),
    subsidiary AS (
      SELECT COALESCE(SUM(l.debit - l.credit), 0) AS amount
        FROM journal_lines l
        JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
        JOIN ledger_accounts a ON a.id = l."accountId"
       WHERE l."orgId" = ${ctx.orgId}
         AND a."systemKey" = 'ACCOUNTS_RECEIVABLE'
         AND l."customerId" IS NOT NULL
         AND l."journalDate" <= ${to}
    )
    SELECT control.amount AS control, subsidiary.amount AS subsidiary FROM control, subsidiary
  `
  const arGap = new Decimal(receivables?.control ?? 0).minus(receivables?.subsidiary ?? 0)
  checks.push({
    key: 'ar-control',
    label: 'Receivables agree with the customer ledger',
    detail: arGap.isZero()
      ? 'Every receivable is attributed to a customer.'
      : `${arGap.toFixed(2)} ${currency} sits in Accounts Receivable without a customer.`,
    severity: arGap.isZero() ? 'ok' : 'blocked',
    href: '/reports/ar-aging',
    howTo:
      'Open AR aging. Find the receivable lines with no customer, reverse those journals, and re-post with the correct customer on each AR line.',
    amount: arGap,
  })

  const stock = await stockAgreesWithLedger(client, ctx.orgId)
  checks.push({
    key: 'inventory',
    label: 'Stock ledger agrees with the Inventory account',
    detail: stock.agrees
      ? 'The stock on hand is worth what the balance sheet says it is.'
      : `The stock ledger and the Inventory Asset account differ by ${stock.difference.toFixed(2)} ${currency}.`,
    severity: stock.agrees ? 'ok' : 'blocked',
    href: '/inventory/stock',
    howTo:
      'Open stock on hand and compare to the Inventory Asset account. Post an inventory adjustment (or fix a mis-posted bill/invoice) until the two figures match.',
    amount: stock.difference,
  })

  // --- Unfinished work ------------------------------------------------------

  const [draftSales, draftPurchases] = await Promise.all([
    client.salesDocument.count({
      where: {
        orgId: ctx.orgId,
        status: 'DRAFT',
        date: { gte: from, lte: to },
        type: { notIn: ['ESTIMATE', 'QUOTATION', 'SALES_ORDER'] },
      },
    }),
    client.purchaseDocument.count({
      where: { orgId: ctx.orgId, status: 'DRAFT', date: { gte: from, lte: to }, type: { not: 'PURCHASE_ORDER' } },
    }),
  ])
  const drafts = draftSales + draftPurchases
  checks.push({
    key: 'drafts',
    label: 'No drafts left in the period',
    detail: drafts === 0
      ? 'Everything dated in this period has been posted.'
      : `${drafts} draft ${drafts === 1 ? 'document is' : 'documents are'} dated in this period. ` +
        `Once it is closed they can no longer be posted at that date.`,
    severity: drafts === 0 ? 'ok' : 'warning',
    href: '/sales/invoices',
    howTo:
      'Open Sales (or Purchases) drafts dated in this period. Post the ones that are ready, or change their date to an open month, or delete them if they should not exist.',
    count: drafts,
  })

  const [unappliedPayments] = await client.$queryRaw<{ count: number; amount: string }[]>`
    SELECT COUNT(*)::int AS count, COALESCE(SUM(p.amount - COALESCE(applied.amount, 0)), 0) AS amount
      FROM customer_payments p
      LEFT JOIN (
        SELECT "paymentId" AS id, SUM(amount) AS amount FROM sales_applications GROUP BY "paymentId"
      ) applied ON applied.id = p.id
     WHERE p."orgId" = ${ctx.orgId}
       AND p."deletedAt" IS NULL
       AND p.status <> 'VOID'
       AND p.date <= ${to}
       AND p.amount - COALESCE(applied.amount, 0) > 0.0001
  `
  const unapplied = new Decimal(unappliedPayments?.amount ?? 0)
  checks.push({
    key: 'unapplied-payments',
    label: 'Customer payments applied to invoices',
    detail: unapplied.isZero()
      ? 'Every payment received has been matched to an invoice.'
      : `${unappliedPayments?.count ?? 0} payment(s) hold ${unapplied.toFixed(2)} ${currency} not applied to any invoice. ` +
        `Cash is banked and the customer's balance is already reduced — apply the payment to invoices when you know which ones.`,
    severity: unapplied.isZero() ? 'ok' : 'warning',
    href: '/payments',
    howTo:
      'Open Payments, find unapplied amounts, and apply each payment to the matching open invoice(s). Leave a credit only if it is intentional.',
    amount: unapplied,
    count: unappliedPayments?.count ?? 0,
  })

  const [undeposited] = await client.$queryRaw<{ balance: string }[]>`
    SELECT COALESCE(SUM(l.debit - l.credit), 0) AS balance
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
      JOIN ledger_accounts a ON a.id = l."accountId"
     WHERE l."orgId" = ${ctx.orgId}
       AND a.subtype = 'UNDEPOSITED_FUNDS'
       AND l."journalDate" <= ${to}
  `
  const held = new Decimal(undeposited?.balance ?? 0)
  checks.push({
    key: 'undeposited',
    label: 'Undeposited funds banked',
    detail: held.isZero()
      ? 'Nothing is sitting in Undeposited Funds.'
      : `${held.toFixed(2)} ${currency} has been received but not yet banked. ` +
        `If it really is in the bank, the deposit has not been recorded.`,
    severity: held.isZero() ? 'ok' : 'warning',
    href: '/banking/deposits/new',
    howTo:
      'Open Banking → New deposit. Move the Undeposited Funds lines into the real bank account for the date the money hit the bank. If the money was never received, reverse the payment instead.',
    amount: held,
  })

  const unreconciled = await client.$queryRaw<{ id: string; name: string; lastDate: Date | null }[]>`
    SELECT a.id   AS id,
           a.name AS name,
           MAX(r."statementDate") AS "lastDate"
      FROM ledger_accounts a
      LEFT JOIN bank_reconciliations r
        ON r."accountId" = a.id AND r.status = 'COMPLETED'
     WHERE a."orgId" = ${ctx.orgId}
       AND a.subtype IN ('BANK', 'CREDIT_CARD')
       AND a."isActive" = true
     GROUP BY a.id, a.name
    HAVING MAX(r."statementDate") IS NULL OR MAX(r."statementDate") < ${to}
  `
  const hardGates = Boolean(ctx.features?.closeHardGates)
  const warnOrBlock = (bad: boolean): CheckSeverity =>
    bad ? (hardGates ? 'blocked' : 'warning') : 'ok'

  checks.push({
    key: 'reconciliation',
    label: 'Bank accounts reconciled to the period end',
    detail: unreconciled.length === 0
      ? 'Every bank and credit card account is reconciled to the end of the period.'
      : unreconciled
          .map((account) =>
            account.lastDate
              ? `${account.name} is reconciled only to ${toCalendarDate(account.lastDate)}`
              : `${account.name} has never been reconciled`,
          )
          .join('; '),
    severity: warnOrBlock(unreconciled.length > 0),
    href: '/banking/accounts',
    howTo:
      'Open Banking → Accounts. For each bank/card listed, start Reconcile, enter the statement ending balance and date, tick cleared lines until the difference is zero, then finish. Skip dormant accounts only if you deactivate them first.',
    count: unreconciled.length,
  })

  const matchHold = await client.purchaseDocument.count({
    where: {
      orgId: ctx.orgId,
      deletedAt: null,
      status: 'MATCH_HOLD',
      date: { lte: to },
    },
  })
  checks.push({
    key: 'match-hold',
    label: 'Three-way match holds cleared',
    detail:
      matchHold === 0
        ? 'No bills are waiting on match variance approval.'
        : `${matchHold} bill(s) on MATCH_HOLD — approve variance or fix receiving before close.`,
    severity: warnOrBlock(matchHold > 0),
    href: '/purchases/bills',
    howTo:
      'Open Purchases → Bills filtered to match hold. Either approve the price/qty variance, or fix the PO/receive quantities so the bill matches, then post.',
    count: matchHold,
  })

  const openWaves = await client.pickWave.count({
    where: { orgId: ctx.orgId, status: { in: ['OPEN', 'RELEASED'] } },
  })
  checks.push({
    key: 'open-waves',
    label: 'Pick waves finished',
    detail:
      openWaves === 0
        ? 'No open or released pick waves.'
        : `${openWaves} pick wave(s) still open or released — complete or cancel them.`,
    severity: warnOrBlock(openWaves > 0),
    href: '/inventory/bins',
    howTo:
      'Open Inventory → bins / picks. Complete each open or released pick wave, or cancel waves that should not ship.',
    count: openWaves,
  })

  const unmatched = await client.importedTransaction.count({
    where: { orgId: ctx.orgId, status: 'PENDING', date: { lte: to } },
  })
  checks.push({
    key: 'imported',
    label: 'Imported bank lines dealt with',
    detail: unmatched === 0
      ? 'No imported statement lines are waiting.'
      : `${unmatched} imported statement line(s) have not been matched or entered.`,
    severity: unmatched === 0 ? 'ok' : 'warning',
    href: '/banking/import',
    howTo:
      'Open Banking → Import. Match each pending line to an existing payment/expense, or create the missing entry, or exclude lines that do not belong on the books.',
    count: unmatched,
  })

  const [openingBalanceEquity] = await client.$queryRaw<{ balance: string }[]>`
    SELECT COALESCE(SUM(l.debit - l.credit), 0) AS balance
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
      JOIN ledger_accounts a ON a.id = l."accountId"
     WHERE l."orgId" = ${ctx.orgId}
       AND a."systemKey" = 'OPENING_BALANCE_EQUITY'
       AND l."journalDate" <= ${to}
  `
  const obe = new Decimal(openingBalanceEquity?.balance ?? 0)
  checks.push({
    key: 'opening-balance-equity',
    label: 'Opening Balance Equity cleared',
    detail: obe.isZero()
      ? 'Nothing is left in Opening Balance Equity.'
      : `${obe.abs().toFixed(2)} ${currency} is still in Opening Balance Equity. ` +
        `It is a staging account: the balance belongs in capital or retained earnings.`,
    severity: obe.isZero() ? 'ok' : 'warning',
    href: '/reports/balance-sheet',
    howTo:
      'Open the Balance Sheet, find Opening Balance Equity, and post a journal that moves that balance into Owner’s Capital or Retained Earnings so OBE returns to zero.',
    amount: obe,
  })

  const foreignJournals = await client.journal.count({
    where: {
      orgId: ctx.orgId,
      status: 'POSTED',
      deletedAt: null,
      currencyCode: { not: currency },
      date: { lte: to },
    },
  })
  checks.push({
    key: 'fx-revaluation',
    label: 'Foreign-currency balances reviewed',
    detail:
      foreignJournals === 0
        ? 'No foreign-currency journals in this period.'
        : `${foreignJournals} foreign-currency journal(s) exist. Revalue open AR/AP at month-end if rates moved.`,
    severity: foreignJournals === 0 ? 'ok' : 'warning',
    href: '/accounting/fx-revaluation',
    howTo:
      'Open FX revaluation. Run month-end revaluation for open foreign AR/AP if rates moved, or confirm no revaluation is needed and leave the warning if intentional.',
    count: foreignJournals,
  })

  return {
    from: range.from,
    to: range.to,
    checks,
    blocked: checks.some((check) => check.severity === 'blocked'),
    warnings: checks.filter((check) => check.severity === 'warning').length,
  }
}

/** Adjusting entries in a range — the ones an auditor asks to see first. */
export async function adjustingEntries(
  orgId: string,
  range: { from: CalendarDate; to: CalendarDate },
  options: { client?: Tx } = {},
) {
  const client = options.client ?? db

  const journals = await client.journal.findMany({
    where: {
      orgId,
      status: { notIn: ['DRAFT', 'DELETED'] },
      date: { gte: toDate(range.from), lte: toDate(range.to) },
      OR: [{ isAdjusting: true }, { isClosingEntry: true }],
    },
    orderBy: [{ date: 'asc' }, { journalNumber: 'asc' }],
    select: {
      id: true,
      journalNumber: true,
      date: true,
      memo: true,
      status: true,
      isAdjusting: true,
      isClosingEntry: true,
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true,
          debit: true,
          credit: true,
          description: true,
          account: { select: { id: true, code: true, name: true } },
        },
      },
    },
  })

  const rows = journals.map((journal) => ({
    ...journal,
    total: journal.lines.reduce((sum, line) => sum.plus(line.debit), ZERO),
  }))

  return { rows, total: rows.reduce((sum, row) => sum.plus(row.total), ZERO) }
}
