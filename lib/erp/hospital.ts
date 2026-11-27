/**
 * Hospital billing-admin helpers — pure (no I/O). Not clinical / EMR.
 */

import { CLAIMS_HEADERS } from '@/lib/erp/export-headers'

export const PATIENT_VISIT_STATUSES = ['OPEN', 'CLOSED', 'CANCELLED'] as const
export type PatientVisitStatus = (typeof PATIENT_VISIT_STATUSES)[number]

export const PATIENT_CLAIM_STATUSES = ['OPEN', 'SUBMITTED', 'PAID', 'DENIED'] as const
export type PatientClaimStatus = (typeof PATIENT_CLAIM_STATUSES)[number]

export function canSubmitClaim(input: {
  visitStatus: PatientVisitStatus
  claimStatus: PatientClaimStatus
}): boolean {
  return input.visitStatus === 'CLOSED' && (input.claimStatus === 'OPEN' || input.claimStatus === 'DENIED')
}

export function canApplyClaimRemittance(input: {
  visitStatus: PatientVisitStatus
  claimStatus: PatientClaimStatus
  hasInvoice: boolean
}): boolean {
  if (input.visitStatus !== 'CLOSED' || !input.hasInvoice) return false
  return input.claimStatus === 'SUBMITTED' || input.claimStatus === 'OPEN'
}

export function visitChargeAmount(quantity: string | number, unitPrice: string | number): string {
  const qty = Number(quantity)
  const price = Number(unitPrice)
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return '0.0000'
  return (qty * price).toFixed(4)
}

export function canAddVisitCharge(status: PatientVisitStatus): boolean {
  return status === 'OPEN'
}

export function canCloseVisit(input: {
  status: PatientVisitStatus
  chargeCount: number
}): boolean {
  return input.status === 'OPEN' && input.chargeCount > 0
}

export function canCancelVisit(status: PatientVisitStatus): boolean {
  return status === 'OPEN'
}

/** Stable claims export row shape (snapshot-friendly). */
export type ClaimExportRow = {
  visitId: string
  patientName: string
  openedAt: string
  closedAt: string | null
  payerName: string | null
  payerRef: string | null
  department: string | null
  invoiceNumber: string | null
  exportBatchId: string | null
  claimsExportedAt: string | null
  claimStatus?: string | null
  billCode: string | null
  description: string
  quantity: string
  unitPrice: string
  amount: string
}

export function claimsToCsv(rows: ClaimExportRow[]): string {
  const header = [...CLAIMS_HEADERS]
  const escape = (value: string | null | undefined) => {
    const raw = value ?? ''
    if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
    return raw
  }
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.visitId,
        row.patientName,
        row.openedAt,
        row.closedAt,
        row.payerName,
        row.payerRef,
        row.department,
        row.invoiceNumber,
        row.exportBatchId,
        row.claimsExportedAt,
        row.claimStatus,
        row.billCode,
        row.description,
        row.quantity,
        row.unitPrice,
        row.amount,
      ]
        .map((cell) => escape(cell))
        .join(','),
    )
  }
  return `${lines.join('\n')}\n`
}
