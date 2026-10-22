import 'server-only'

import { toDate, type CalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import { computeLineTax } from '@/server/accounting/tax'
import { db, type Tx } from '@/server/db'

/**
 * The reports that answer questions about the trade rather than about the
 * accounts: who buys, what sells, where the money goes, what is owed to the tax
 * authority.
 *
 * All of them read the ledger, not the documents. A sale that was invoiced,
 * edited and re-posted appears once, at its current value — because the ledger is
 * the record of what happened, and the documents are only how it was entered.
 */

export type RankedRow = {
  id: string
  name: string
  amount: Decimal
  count: number
  share: Decimal
}

function rank(rows: { id: string; name: string; amount: string; count: number }[]): {
  rows: RankedRow[]
  total: Decimal
} {
  const parsed = rows.map((row) => ({
    id: row.id,
    name: row.name,
    amount: new Decimal(row.amount),
    count: Number(row.count),
    share: ZERO,
  }))
  const total = parsed.reduce((sum, row) => sum.plus(row.amount), ZERO)

  for (const row of parsed) {
    row.share = total.isZero() ? ZERO : row.amount.dividedBy(total).times(100).toDecimalPlaces(1)
  }

  return { rows: parsed.sort((a, b) => b.amount.comparedTo(a.amount)), total }
}

/**
 * Sales by customer.
 *
 * Read from the sales documents net of tax, because tax collected is the
 * agency's money passing through and was never the customer's spend with us.
 * Credit memos and refunds subtract, so a customer who returned everything
 * reads zero rather than reading twice.
 */
export async function salesByCustomer(
  orgId: string,
  range: { from: CalendarDate; to: CalendarDate },
  options: { client?: Tx } = {},
) {
  const client = options.client ?? db

  const rows = await client.$queryRaw<{ id: string; name: string; amount: string; count: number }[]>`
    SELECT c.id            AS id,
           c."displayName" AS name,
           COALESCE(SUM(CASE WHEN d.type IN ('CREDIT_MEMO', 'REFUND_RECEIPT') THEN -d.subtotal ELSE d.subtotal END), 0) AS amount,
           COUNT(d.id)::int AS count
      FROM sales_documents d
      JOIN customers c ON c.id = d."customerId"
     WHERE d."orgId" = ${orgId}
       AND d.status NOT IN ('DRAFT', 'VOID')
        AND d."deletedAt" IS NULL
       AND d.type IN ('INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT')
       AND d.date BETWEEN ${toDate(range.from)} AND ${toDate(range.to)}
     GROUP BY c.id, c."displayName"
  `

  return rank(rows)
}

/** Income by item, from the sales document lines that produced it. */
export async function salesByItem(
  orgId: string,
  range: { from: CalendarDate; to: CalendarDate },
  options: { client?: Tx } = {},
) {
  const client = options.client ?? db

  const rows = await client.$queryRaw<
    {
      id: string
      name: string
      amount: string
      count: number
      quantity: string
      unitOfMeasure: string | null
    }[]
  >`
    SELECT i.id                     AS id,
           i.name                   AS name,
           COALESCE(SUM(CASE WHEN d.type IN ('CREDIT_MEMO', 'REFUND_RECEIPT') THEN -l.amount ELSE l.amount END), 0) AS amount,
           COUNT(DISTINCT d.id)::int AS count,
           COALESCE(SUM(CASE WHEN d.type IN ('CREDIT_MEMO', 'REFUND_RECEIPT') THEN -l.quantity ELSE l.quantity END), 0) AS quantity,
           i."unitOfMeasure"        AS "unitOfMeasure"
      FROM sales_document_lines l
      JOIN sales_documents d ON d.id = l."documentId"
      JOIN items i ON i.id = l."itemId"
     WHERE d."orgId" = ${orgId}
       AND d.status NOT IN ('DRAFT', 'VOID')
        AND d."deletedAt" IS NULL
       AND d.type IN ('INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT')
       AND d.date BETWEEN ${toDate(range.from)} AND ${toDate(range.to)}
     GROUP BY i.id, i.name, i."unitOfMeasure"
  `

  const ranked = rank(rows)
  const quantityById = new Map(rows.map((row) => [row.id, new Decimal(row.quantity)]))
  const unitById = new Map(rows.map((row) => [row.id, row.unitOfMeasure]))

  return {
    ...ranked,
    rows: ranked.rows.map((row) => ({
      ...row,
      quantity: quantityById.get(row.id) ?? ZERO,
      unitOfMeasure: unitById.get(row.id) ?? null,
    })),
  }
}

/** What was bought, by vendor. */
export async function purchasesByVendor(
  orgId: string,
  range: { from: CalendarDate; to: CalendarDate },
  options: { client?: Tx } = {},
) {
  const client = options.client ?? db

  const rows = await client.$queryRaw<{ id: string; name: string; amount: string; count: number }[]>`
    SELECT v.id            AS id,
           v."displayName" AS name,
           COALESCE(SUM(CASE WHEN d.type = 'VENDOR_CREDIT' THEN -d.subtotal ELSE d.subtotal END), 0) AS amount,
           COUNT(d.id)::int AS count
      FROM purchase_documents d
      JOIN vendors v ON v.id = d."vendorId"
     WHERE d."orgId" = ${orgId}
       AND d.status NOT IN ('DRAFT', 'VOID')
        AND d."deletedAt" IS NULL
       AND d.type IN ('BILL', 'EXPENSE', 'VENDOR_CREDIT')
       AND d.date BETWEEN ${toDate(range.from)} AND ${toDate(range.to)}
     GROUP BY v.id, v."displayName"
  `

  return rank(rows)
}

/** Where the money went, by expense account. */
export async function expensesByCategory(
  orgId: string,
  range: { from: CalendarDate; to: CalendarDate },
  options: { client?: Tx } = {},
) {
  const client = options.client ?? db

  const rows = await client.$queryRaw<{ id: string; name: string; amount: string; count: number }[]>`
    SELECT a.id                             AS id,
           a.code || ' ' || a.name          AS name,
           COALESCE(SUM(l.debit - l.credit), 0) AS amount,
           COUNT(DISTINCT j.id)::int        AS count
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
      JOIN ledger_accounts a ON a.id = l."accountId"
     WHERE l."orgId" = ${orgId}
       AND a.type = 'EXPENSE'
       AND l."journalDate" BETWEEN ${toDate(range.from)} AND ${toDate(range.to)}
     GROUP BY a.id, a.code, a.name
    HAVING COALESCE(SUM(l.debit - l.credit), 0) <> 0
  `

  return rank(rows)
}

export type TaxSummaryRow = {
  rateId: string
  rateName: string
  agencyName: string
  ratePercent: Decimal
  salesNet: Decimal
  salesTax: Decimal
  purchaseNet: Decimal
  purchaseTax: Decimal
  /** What is owed to the agency: collected on sales, less reclaimable on purchases. */
  net: Decimal
}

type TaxLine = {
  amount: Decimal
  sign: number
  taxCode: {
    id: string
    name: string
    isInclusive: boolean
    components: {
      taxRateId: string
      sequence: number
      isCompound: boolean
      taxRate: { name: string; rate: Decimal; agency: { name: string } }
    }[]
  } | null
}

/**
 * Tax collected and reclaimable, rate by rate.
 *
 * A return is filed per rate, but a line stores only its total tax — a code
 * carrying two rates posts one figure. So the split is recomputed here with the
 * same function that produced the posted total, which makes the two agree by
 * construction rather than by hope.
 *
 * The stored line `amount` is already tax-exclusive, so the components are
 * recomputed on that net with the code treated as exclusive; for an inclusive
 * code that is the same arithmetic, one step further along.
 */
export async function taxSummary(
  orgId: string,
  range: { from: CalendarDate; to: CalendarDate },
  options: { client?: Tx } = {},
): Promise<{ rows: TaxSummaryRow[]; totalNet: Decimal }> {
  const client = options.client ?? db

  const org = await client.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { baseCurrency: true },
  })

  const include = {
    taxCode: {
      select: {
        id: true,
        name: true,
        isInclusive: true,
        components: {
          select: {
            taxRateId: true,
            sequence: true,
            isCompound: true,
            taxRate: { select: { name: true, rate: true, agency: { select: { name: true } } } },
          },
        },
      },
    },
  } as const

  const dates = { gte: toDate(range.from), lte: toDate(range.to) }

  const [salesLines, purchaseLines] = await Promise.all([
    client.salesDocumentLine.findMany({
      where: {
        orgId,
        taxCodeId: { not: null },
        document: {
          date: dates,
          status: { notIn: ['DRAFT', 'VOID'] },
          type: { in: ['INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT'] },
        },
      },
      select: { amount: true, document: { select: { type: true } }, ...include },
    }),
    client.purchaseDocumentLine.findMany({
      where: {
        orgId,
        taxCodeId: { not: null },
        document: {
          date: dates,
          status: { notIn: ['DRAFT', 'VOID'] },
          type: { in: ['BILL', 'EXPENSE', 'VENDOR_CREDIT'] },
        },
      },
      select: { amount: true, document: { select: { type: true } }, ...include },
    }),
  ])

  const rows = new Map<string, TaxSummaryRow>()

  const accumulate = (lines: TaxLine[], side: 'sales' | 'purchase') => {
    for (const line of lines) {
      if (!line.taxCode) continue

      // The amount is already net, so charge the components on top of it.
      const result = computeLineTax(
        line.amount,
        {
          id: line.taxCode.id,
          name: line.taxCode.name,
          isInclusive: false,
          components: line.taxCode.components.map((component) => ({
            taxRateId: component.taxRateId,
            name: component.taxRate.name,
            rate: component.taxRate.rate,
            sequence: component.sequence,
            isCompound: component.isCompound,
            salesAccountId: null,
            purchaseAccountId: null,
          })),
        },
        org.baseCurrency,
      )

      for (const component of result.components) {
        const source = line.taxCode.components.find((c) => c.taxRateId === component.taxRateId)!
        const row =
          rows.get(component.taxRateId) ??
          {
            rateId: component.taxRateId,
            rateName: component.name,
            agencyName: source.taxRate.agency.name,
            ratePercent: component.rate.times(100),
            salesNet: ZERO,
            salesTax: ZERO,
            purchaseNet: ZERO,
            purchaseTax: ZERO,
            net: ZERO,
          }

        const net = line.amount.times(line.sign)
        const tax = component.amount.times(line.sign)

        if (side === 'sales') {
          row.salesNet = row.salesNet.plus(net)
          row.salesTax = row.salesTax.plus(tax)
        } else {
          row.purchaseNet = row.purchaseNet.plus(net)
          row.purchaseTax = row.purchaseTax.plus(tax)
        }

        rows.set(component.taxRateId, row)
      }
    }
  }

  const signed = <T extends { amount: Decimal; document: { type: string } }>(
    lines: T[],
    credits: string[],
  ): TaxLine[] =>
    lines.map((line) => ({
      ...(line as unknown as TaxLine),
      sign: credits.includes(line.document.type) ? -1 : 1,
    }))

  accumulate(signed(salesLines, ['CREDIT_MEMO', 'REFUND_RECEIPT']), 'sales')
  accumulate(signed(purchaseLines, ['VENDOR_CREDIT']), 'purchase')

  const result = [...rows.values()]
    .map((row) => ({ ...row, net: row.salesTax.minus(row.purchaseTax) }))
    .sort((a, b) => a.agencyName.localeCompare(b.agencyName) || a.rateName.localeCompare(b.rateName))

  return {
    rows: result,
    totalNet: result.reduce((sum, row) => sum.plus(row.net), ZERO),
  }
}
