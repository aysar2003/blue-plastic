import 'server-only'

import { toCalendarDate, type CalendarDate } from '@/lib/date'
import {
  buildVatReturnBoxes,
  payrollStatutoryToCsv,
  vatReturnToCsv,
  type PayrollStatutoryLine,
} from '@/lib/statutory-exports'
import { Decimal, ZERO } from '@/lib/money'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { taxSummary } from '@/server/reports/business'

/**
 * Posted payslips in range as a statutory-shaped CSV/JSON export (one jurisdiction pack).
 */
export async function payrollStatutoryExport(
  ctx: OrgContext,
  range: { from: CalendarDate; to: CalendarDate },
): Promise<{ rows: PayrollStatutoryLine[]; csv: string; json: string }> {
  assertPermission(ctx, 'hr:payroll')

  const slips = await db.payslip.findMany({
    where: {
      orgId: ctx.orgId,
      included: true,
      run: {
        status: 'POSTED',
        periodStart: { lte: new Date(`${range.to}T00:00:00.000Z`) },
        periodEnd: { gte: new Date(`${range.from}T00:00:00.000Z`) },
      },
    },
    orderBy: [{ run: { periodStart: 'asc' } }, { number: 'asc' }],
    select: {
      number: true,
      gross: true,
      deductions: true,
      employer: true,
      net: true,
      run: { select: { id: true, periodStart: true, periodEnd: true } },
      employee: {
        select: {
          id: true,
          name: true,
          department: true,
        },
      },
      lines: {
        orderBy: { sortOrder: 'asc' },
        select: {
          code: true,
          label: true,
          kind: true,
          amount: true,
          affectsNet: true,
        },
      },
    },
  })

  const rows: PayrollStatutoryLine[] = slips.map((slip) => ({
    runId: slip.run.id,
    periodStart: toCalendarDate(slip.run.periodStart),
    periodEnd: toCalendarDate(slip.run.periodEnd),
    payslipNumber: slip.number,
    employeeCode: slip.employee.id,
    employeeName: slip.employee.name,
    department: slip.employee.department,
    gross: new Decimal(slip.gross.toString()).toFixed(2),
    deductions: new Decimal(slip.deductions.toString()).toFixed(2),
    employer: new Decimal(slip.employer.toString()).toFixed(2),
    net: new Decimal(slip.net.toString()).toFixed(2),
    lines: slip.lines.map((line) => ({
      code: line.code,
      label: line.label,
      kind: line.kind,
      amount: new Decimal(line.amount.toString()).toFixed(2),
      affectsNet: line.affectsNet,
    })),
  }))

  return {
    rows,
    csv: payrollStatutoryToCsv(rows),
    json: JSON.stringify(
      {
        jurisdiction: ctx.organization.country ?? 'SO',
        from: range.from,
        to: range.to,
        currency: ctx.organization.baseCurrency,
        payslips: rows,
      },
      null,
      2,
    ),
  }
}

/**
 * One-jurisdiction VAT return boxes from posted tax lines (via taxSummary).
 */
export async function vatReturnExport(
  ctx: OrgContext,
  range: { from: CalendarDate; to: CalendarDate },
) {
  assertPermission(ctx, 'report:read')
  if (!ctx.features.enableTax) {
    return {
      boxes: buildVatReturnBoxes({
        jurisdiction: ctx.organization.country ?? 'SO',
        from: range.from,
        to: range.to,
        salesNet: 0,
        salesTax: 0,
        purchaseNet: 0,
        purchaseTax: 0,
      }),
      csv: '',
      json: '',
      disabled: true as const,
    }
  }

  const summary = await taxSummary(ctx.orgId, range)
  let salesNet = ZERO
  let salesTax = ZERO
  let purchaseNet = ZERO
  let purchaseTax = ZERO
  for (const row of summary.rows) {
    salesNet = salesNet.plus(row.salesNet)
    salesTax = salesTax.plus(row.salesTax)
    purchaseNet = purchaseNet.plus(row.purchaseNet)
    purchaseTax = purchaseTax.plus(row.purchaseTax)
  }

  const jurisdiction = ctx.organization.country?.trim() || 'SO'
  const boxes = buildVatReturnBoxes({
    jurisdiction,
    from: range.from,
    to: range.to,
    salesNet,
    salesTax,
    purchaseNet,
    purchaseTax,
  })

  return {
    boxes,
    csv: vatReturnToCsv(boxes),
    json: JSON.stringify(
      {
        jurisdiction: boxes.jurisdiction,
        from: boxes.from,
        to: boxes.to,
        currency: ctx.organization.baseCurrency,
        boxes: {
          box1_taxable_supplies: boxes.box1TaxableSupplies.toFixed(2),
          box2_output_vat: boxes.box2OutputVat.toFixed(2),
          box3_taxable_purchases: boxes.box3TaxablePurchases.toFixed(2),
          box4_input_vat: boxes.box4InputVat.toFixed(2),
          box5_net_vat_due: boxes.box5NetVatDue.toFixed(2),
        },
        rates: summary.rows.map((row) => ({
          rate: row.rateName,
          agency: row.agencyName,
          salesNet: row.salesNet.toFixed(2),
          salesTax: row.salesTax.toFixed(2),
          purchaseNet: row.purchaseNet.toFixed(2),
          purchaseTax: row.purchaseTax.toFixed(2),
        })),
      },
      null,
      2,
    ),
    disabled: false as const,
  }
}
