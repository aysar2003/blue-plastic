/**
 * Hospital billing-admin helpers — pure (no I/O). Not clinical / EMR.
 */

export const PATIENT_VISIT_STATUSES = ['OPEN', 'CLOSED', 'CANCELLED'] as const
export type PatientVisitStatus = (typeof PATIENT_VISIT_STATUSES)[number]

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
  billCode: string | null
  description: string
  quantity: string
  unitPrice: string
  amount: string
}

export function claimsToCsv(rows: ClaimExportRow[]): string {
  const header = [
    'visitId',
    'patientName',
    'openedAt',
    'closedAt',
    'payerName',
    'payerRef',
    'department',
    'invoiceNumber',
    'billCode',
    'description',
    'quantity',
    'unitPrice',
    'amount',
  ]
  const escape = (value: string | null) => {
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
