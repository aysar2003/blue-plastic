import 'server-only'

import { toDate, type CalendarDate } from '@/lib/date'
import type { VendorStatementKind } from '@/lib/vendor-statement'
import { Decimal, ZERO } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import {
  AGING_BUCKETS,
  BUCKET_LABELS,
  emptyBuckets,
  OVERDUE_BUCKETS,
  type AgingBucket,
  type StatementItem,
} from '@/server/services/receivables.service'

export { AGING_BUCKETS, BUCKET_LABELS, OVERDUE_BUCKETS }

export type PayablesAgingRow = {
  vendorId: string
  vendorName: string
  buckets: Record<AgingBucket, Decimal>
  total: Decimal
}

/**
 * What the business owes, and for how long — the mirror of the receivables aging.
 *
 * Same construction, same self-check: every figure comes from the same rows as
 * the payables control account, and the report says whether it agrees rather than
 * leaving it to be assumed.
 */
export async function aging(
  ctx: OrgContext,
  asOf: CalendarDate,
  options: { client?: Tx } = {},
): Promise<{
  rows: PayablesAgingRow[]
  totals: Record<AgingBucket, Decimal>
  grandTotal: Decimal
  controlBalance: Decimal
  agrees: boolean
  asOf: CalendarDate
}> {
  const client = options.client ?? db
  const asOfDate = toDate(asOf)

  const [rows, subledger] = await Promise.all([
    client.$queryRaw<
      { vendorId: string; vendorName: string; days: number | null; outstanding: string }[]
    >`
      SELECT d."vendorId"                      AS "vendorId",
             v."displayName"                   AS "vendorName",
             (${asOfDate}::date - d."dueDate") AS days,
             (d.total - COALESCE((
                SELECT SUM(a.amount) FROM purchase_applications a WHERE a."billId" = d.id
             ), 0))                            AS outstanding
        FROM purchase_documents d
        JOIN vendors v ON v.id = d."vendorId"
       WHERE d."orgId" = ${ctx.orgId}
         AND d."deletedAt" IS NULL
         AND d.type    = 'BILL'
         AND d.status IN ('OPEN', 'PARTIAL')
         AND d.date   <= ${asOfDate}
    `,
    // Payables are a credit balance, so the control account is read the other
    // way up. Broken down by vendor for the same reason the receivables report
    // breaks its control account down by customer: an opening balance, an
    // unapplied payment or a hand-written entry is a real payable with no open
    // bill behind it, and leaving it out is what made the two disagree.
    client.$queryRaw<{ vendorId: string; vendorName: string; balance: string }[]>`
      SELECT l."vendorId"     AS "vendorId",
             v."displayName"  AS "vendorName",
             COALESCE(SUM(l.credit - l.debit), 0) AS balance
        FROM journal_lines l
        JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
        JOIN ledger_accounts a ON a.id = l."accountId"
        JOIN vendors v ON v.id = l."vendorId"
       WHERE l."orgId" = ${ctx.orgId}
         AND a."systemKey" = 'ACCOUNTS_PAYABLE'
         AND l."journalDate" <= ${asOfDate}
       GROUP BY l."vendorId", v."displayName"
    `,
  ])

  const byVendor = new Map<string, PayablesAgingRow>()
  const totals = emptyBuckets()
  let grandTotal = ZERO

  const rowFor = (vendorId: string, vendorName: string): PayablesAgingRow => {
    const existing = byVendor.get(vendorId)
    if (existing) return existing
    const created: PayablesAgingRow = {
      vendorId,
      vendorName,
      buckets: emptyBuckets(),
      total: ZERO,
    }
    byVendor.set(vendorId, created)
    return created
  }

  const add = (row: PayablesAgingRow, bucket: AgingBucket, amount: Decimal) => {
    row.buckets[bucket] = row.buckets[bucket].plus(amount)
    row.total = row.total.plus(amount)
    totals[bucket] = totals[bucket].plus(amount)
    grandTotal = grandTotal.plus(amount)
  }

  const documentTotals = new Map<string, Decimal>()

  for (const row of rows) {
    const outstanding = new Decimal(row.outstanding)
    if (outstanding.lessThanOrEqualTo(0)) continue

    add(rowFor(row.vendorId, row.vendorName), bucketFor(row.days), outstanding)
    documentTotals.set(row.vendorId, (documentTotals.get(row.vendorId) ?? ZERO).plus(outstanding))
  }

  for (const entry of subledger) {
    const balance = new Decimal(entry.balance)
    const residual = balance.minus(documentTotals.get(entry.vendorId) ?? ZERO)
    if (residual.abs().lessThan('0.005')) continue

    add(rowFor(entry.vendorId, entry.vendorName), 'unapplied', residual)
  }

  const controlBalance = subledger.reduce(
    (sum, entry) => sum.plus(new Decimal(entry.balance)),
    ZERO,
  )

  return {
    rows: [...byVendor.values()]
      .filter((row) => !row.total.isZero())
      .sort((a, b) => a.vendorName.localeCompare(b.vendorName)),
    totals,
    grandTotal,
    controlBalance,
    agrees: grandTotal.minus(controlBalance).abs().lessThan('0.005'),
    asOf,
  }
}

function bucketFor(daysOverdue: number | null): AgingBucket {
  if (daysOverdue === null || daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return 'd1_30'
  if (daysOverdue <= 60) return 'd31_60'
  if (daysOverdue <= 90) return 'd61_90'
  return 'd90_plus'
}

/** Everything still owed, oldest first — the list someone works through on pay day. */
export async function unpaidBills(ctx: OrgContext, asOf: CalendarDate) {
  const bills = await db.purchaseDocument.findMany({
    where: { orgId: ctx.orgId, type: 'BILL', status: { in: ['OPEN', 'PARTIAL'] } },
    select: {
      id: true, number: true, reference: true, date: true, dueDate: true, total: true,
      vendor: { select: { id: true, displayName: true } },
      applications: { select: { amount: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { date: 'asc' }],
  })

  return bills
    .map((bill) => {
      const applied = bill.applications.reduce((sum, a) => sum.plus(a.amount.toString()), ZERO)
      const balance = new Decimal(bill.total.toString()).minus(applied)
      const daysOverdue = bill.dueDate
        ? Math.floor((toDate(asOf).getTime() - bill.dueDate.getTime()) / 86_400_000)
        : 0
      return { ...bill, total: bill.total.toString(), balance, daysOverdue }
    })
    .filter((bill) => bill.balance.greaterThan(0))
}

export type VendorStatementEntry = {
  id: string
  kind: VendorStatementKind
  number: string
  date: Date
  dueDate: Date | null
  description: string
  /** What increased the amount owed. */
  charge: Decimal
  /** What reduced it. */
  credit: Decimal
  /** Still unpaid on this document. Zero when the row does not carry its own balance. */
  openAmount: Decimal
  /** Document total, before anything was applied. */
  original: Decimal
  balance: Decimal
  lines: StatementItem[]
  href: string
}

/**
 * A vendor statement: everything that moved what the business owes them, in date
 * order, with a running balance.
 *
 * The mirror of the customer statement, and it exists for the same reason —
 * "what do we owe you?" is a question with one right answer, and it should come
 * from the same rows as the payables control account rather than from a separate
 * tally. Expenses are listed for completeness and do not move the balance:
 * they never became a payable.
 */
export async function vendorStatement(
  ctx: OrgContext,
  vendorId: string,
  range: { from: CalendarDate; to: CalendarDate },
  options: { client?: Tx } = {},
): Promise<{ opening: Decimal; entries: VendorStatementEntry[]; closing: Decimal }> {
  const client = options.client ?? db

  const [openingRow] = await client.$queryRaw<{ balance: string }[]>`
    SELECT COALESCE(SUM(l.credit - l.debit), 0) AS balance
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
      JOIN ledger_accounts a ON a.id = l."accountId"
     WHERE l."orgId" = ${ctx.orgId}
       AND l."vendorId" = ${vendorId}
       AND a.subtype::text = 'ACCOUNTS_PAYABLE'
       AND l."journalDate" < ${toDate(range.from)}
  `
  const opening = new Decimal(openingRow?.balance ?? '0')

  const from = toDate(range.from)
  const to = toDate(range.to)

  const [documents, payments, journals] = await Promise.all([
    client.purchaseDocument.findMany({
      where: {
        orgId: ctx.orgId,
        vendorId,
        status: { notIn: ['DRAFT', 'VOID'] },
        type: { in: ['BILL', 'VENDOR_CREDIT', 'EXPENSE', 'PURCHASE_ORDER'] },
        date: { gte: from, lte: to },
      },
      select: {
        id: true,
        type: true,
        number: true,
        date: true,
        dueDate: true,
        total: true,
        taxTotal: true,
        memo: true,
        reference: true,
        applications: { select: { amount: true } },
        creditsApplied: { select: { amount: true } },
        lines: {
          orderBy: { lineNumber: 'asc' },
          select: {
            description: true,
            quantity: true,
            unitPrice: true,
            amount: true,
            item: { select: { name: true } },
          },
        },
      },
    }),
    client.billPayment.findMany({
      where: {
        orgId: ctx.orgId,
        vendorId,
        status: { not: 'VOID' },
        date: { gte: from, lte: to },
      },
      select: {
        id: true,
        number: true,
        date: true,
        amount: true,
        memo: true,
        reference: true,
        applications: { select: { amount: true } },
      },
    }),
    client.journalLine.findMany({
      where: {
        orgId: ctx.orgId,
        vendorId,
        journalDate: { gte: from, lte: to },
        account: { subtype: 'ACCOUNTS_PAYABLE' },
        journal: {
          status: { notIn: ['DRAFT', 'DELETED'] },
          purchaseDocuments: { none: {} },
          billPayments: { none: {} },
        },
      },
      select: {
        id: true,
        debit: true,
        credit: true,
        description: true,
        journalDate: true,
        journal: { select: { id: true, journalNumber: true, memo: true } },
      },
    }),
  ])

  const slug: Record<string, string> = {
    BILL: 'bills',
    VENDOR_CREDIT: 'vendor-credits',
    EXPENSE: 'expenses',
    PURCHASE_ORDER: 'purchase-orders',
  }

  const entries: Omit<VendorStatementEntry, 'balance'>[] = [
    ...documents.map((document) => {
      const total = new Decimal(document.total.toString())
      const applied = sumAmounts(document.applications)
      const creditUsed = sumAmounts(document.creditsApplied)
      const isBill = document.type === 'BILL'
      const isCredit = document.type === 'VENDOR_CREDIT'
      const items: StatementItem[] = document.lines.map((line) => {
        const name = line.item?.name
        const note = line.description
        const description = name && note && name !== note ? `${name} — ${note}` : name || note || 'Line'
        return {
          description,
          quantity: line.quantity.toString(),
          rate: line.unitPrice.toString(),
          amount: line.amount.toString(),
        }
      })
      const tax = new Decimal(document.taxTotal.toString())
      if (!tax.isZero()) {
        items.push({ description: 'Tax', quantity: '', rate: '', amount: tax.toString() })
      }
      return {
        id: document.id,
        kind: document.type as VendorStatementKind,
        number: document.number,
        date: document.date,
        dueDate: document.dueDate,
        description: document.memo ?? document.reference ?? labelFor(document.type),
        charge: isBill ? total : ZERO,
        credit: isCredit ? total : ZERO,
        openAmount: isBill ? total.minus(applied) : isCredit ? total.minus(creditUsed) : ZERO,
        original: total,
        lines: items,
        href: `/purchases/${slug[document.type] ?? 'bills'}/${document.id}`,
      }
    }),
    ...payments.map((payment) => {
      const amount = new Decimal(payment.amount.toString())
      return {
        id: payment.id,
        kind: 'PAYMENT' as const,
        number: payment.number,
        date: payment.date,
        dueDate: null,
        description: payment.memo ?? payment.reference ?? 'Payment made',
        charge: ZERO,
        credit: amount,
        openAmount: amount.minus(sumAmounts(payment.applications)),
        original: amount,
        lines: [],
        href: `/bill-payments?q=${encodeURIComponent(payment.number)}`,
      }
    }),
    ...journals.map((line) => {
      const debit = new Decimal(line.debit.toString())
      const credit = new Decimal(line.credit.toString())
      return {
        id: line.id,
        kind: 'JOURNAL' as const,
        number: line.journal.journalNumber,
        date: line.journalDate,
        dueDate: null,
        description: line.description ?? line.journal.memo ?? 'Journal entry',
        charge: credit,
        credit: debit,
        openAmount: credit.minus(debit),
        original: credit.minus(debit).abs(),
        lines: [],
        href: `/journals/${line.journal.id}`,
      }
    }),
  ].sort((a, b) => a.date.getTime() - b.date.getTime() || a.number.localeCompare(b.number))

  let running = opening
  const withBalances = entries.map((entry) => {
    running = running.plus(entry.charge).minus(entry.credit)
    return { ...entry, balance: running }
  })

  return { opening, entries: withBalances, closing: running }
}

function sumAmounts(rows: { amount: { toString(): string } }[]): Decimal {
  return rows.reduce((sum, row) => sum.plus(row.amount.toString()), ZERO)
}

function labelFor(type: string): string {
  switch (type) {
    case 'BILL':
      return 'Bill'
    case 'VENDOR_CREDIT':
      return 'Vendor credit'
    case 'EXPENSE':
      return 'Expense'
    case 'PURCHASE_ORDER':
      return 'Purchase order'
    default:
      return type
  }
}
