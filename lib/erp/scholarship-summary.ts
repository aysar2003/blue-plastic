import { Decimal, ZERO } from '@/lib/money'
import { scholarshipDiscountAmount, normalizeScholarshipPercent } from '@/lib/erp/education'

export type ScholarshipEnrollmentRow = {
  status: string
  feeSubtotal: string
  scholarshipPercent: string | number
}

export function scholarshipSummaryTotals(rows: ScholarshipEnrollmentRow[]) {
  let enrollments = 0
  let gross = ZERO
  let waived = ZERO

  for (const row of rows) {
    if (row.status !== 'ENROLLED') continue
    enrollments += 1
    const subtotal = new Decimal(row.feeSubtotal || '0')
    gross = gross.plus(subtotal)
    const pct = normalizeScholarshipPercent(row.scholarshipPercent)
    waived = waived.plus(scholarshipDiscountAmount(subtotal.toString(), pct))
  }

  const net = gross.minus(waived)
  return {
    enrollmentCount: enrollments,
    gross: gross.toFixed(2),
    scholarshipWaived: waived.toFixed(2),
    net: net.toFixed(2),
  }
}

export type ScholarshipCsvRow = {
  termName: string
  enrollmentCount: number
  gross: string
  scholarshipWaived: string
  net: string
}

/** CSV body rows for scholarship summary export (header excluded). */
export function scholarshipSummaryCsvRows(blocks: ScholarshipCsvRow[]) {
  return blocks.map((block) => [
    block.termName,
    block.enrollmentCount,
    block.gross,
    block.scholarshipWaived,
    block.net,
  ])
}