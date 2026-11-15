import { Decimal, ZERO } from '@/lib/money'
import { localizationPackById } from '@/lib/localization/packs'

export type PayrollStatutoryLine = {
  runId: string
  periodStart: string
  periodEnd: string
  payslipNumber: string | null
  employeeCode: string | null
  employeeName: string
  department: string | null
  gross: string
  deductions: string
  employer: string
  net: string
  lines: { code: string; label: string; kind: string; amount: string; affectsNet: boolean }[]
}

export type VatReturnBoxes = {
  jurisdiction: string
  from: string
  to: string
  /** Taxable supplies (sales net) */
  box1TaxableSupplies: Decimal
  /** Output VAT */
  box2OutputVat: Decimal
  /** Taxable purchases */
  box3TaxablePurchases: Decimal
  /** Input VAT */
  box4InputVat: Decimal
  /** Net VAT due (output − input); negative = reclaim */
  box5NetVatDue: Decimal
}

export function buildVatReturnBoxes(input: {
  jurisdiction: string
  from: string
  to: string
  salesNet: Decimal.Value
  salesTax: Decimal.Value
  purchaseNet: Decimal.Value
  purchaseTax: Decimal.Value
}): VatReturnBoxes {
  const box1 = new Decimal(input.salesNet)
  const box2 = new Decimal(input.salesTax)
  const box3 = new Decimal(input.purchaseNet)
  const box4 = new Decimal(input.purchaseTax)
  return {
    jurisdiction: input.jurisdiction,
    from: input.from,
    to: input.to,
    box1TaxableSupplies: box1,
    box2OutputVat: box2,
    box3TaxablePurchases: box3,
    box4InputVat: box4,
    box5NetVatDue: box2.minus(box4),
  }
}

export function payrollStatutoryToCsv(
  rows: PayrollStatutoryLine[],
  headerOverride?: string[],
): string {
  const defaultHeader = [
    'periodStart',
    'periodEnd',
    'payslipNumber',
    'employeeCode',
    'employeeName',
    'department',
    'gross',
    'deductions',
    'employer',
    'net',
    'lineCode',
    'lineLabel',
    'lineKind',
    'lineAmount',
  ]
  const header = headerOverride ?? defaultHeader
  const out: string[] = [header.join(',')]
  for (const row of rows) {
    if (row.lines.length === 0) {
      out.push(
        [
          row.periodStart,
          row.periodEnd,
          row.payslipNumber ?? '',
          row.employeeCode ?? '',
          csvEscape(row.employeeName),
          csvEscape(row.department ?? ''),
          row.gross,
          row.deductions,
          row.employer,
          row.net,
          '',
          '',
          '',
          '',
        ].join(','),
      )
      continue
    }
    for (const line of row.lines) {
      out.push(
        [
          row.periodStart,
          row.periodEnd,
          row.payslipNumber ?? '',
          row.employeeCode ?? '',
          csvEscape(row.employeeName),
          csvEscape(row.department ?? ''),
          row.gross,
          row.deductions,
          row.employer,
          row.net,
          csvEscape(line.code),
          csvEscape(line.label),
          line.kind,
          line.amount,
        ].join(','),
      )
    }
  }
  return `${out.join('\r\n')}\r\n`
}

export function vatReturnToCsv(
  boxes: VatReturnBoxes,
  labels?: Partial<Record<'box1' | 'box2' | 'box3' | 'box4' | 'box5', string>> | null,
): string {
  const L = {
    box1: labels?.box1 ?? 'box1_taxable_supplies',
    box2: labels?.box2 ?? 'box2_output_vat',
    box3: labels?.box3 ?? 'box3_taxable_purchases',
    box4: labels?.box4 ?? 'box4_input_vat',
    box5: labels?.box5 ?? 'box5_net_vat_due',
  }
  const rows = [
    ['jurisdiction', boxes.jurisdiction],
    ['from', boxes.from],
    ['to', boxes.to],
    [L.box1, boxes.box1TaxableSupplies.toFixed(2)],
    [L.box2, boxes.box2OutputVat.toFixed(2)],
    [L.box3, boxes.box3TaxablePurchases.toFixed(2)],
    [L.box4, boxes.box4InputVat.toFixed(2)],
    [L.box5, boxes.box5NetVatDue.toFixed(2)],
  ]
  return `box,amount\r\n${rows.map((row) => `${csvEscape(row[0])},${row[1]}`).join('\r\n')}\r\n`
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

export function emptyVatTotals() {
  return { salesNet: ZERO, salesTax: ZERO, purchaseNet: ZERO, purchaseTax: ZERO }
}

/** Pack-aware payroll CSV headers (Phase 40). */
export function payrollStatutoryToCsvForPack(
  rows: PayrollStatutoryLine[],
  localizationPackId: string | null | undefined,
): string {
  const pack = localizationPackById(localizationPackId)
  return payrollStatutoryToCsv(rows, pack?.payrollCsvHeaders)
}
