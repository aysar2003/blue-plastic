import { describe, expect, it } from 'vitest'

import {
  canAddVisitCharge,
  canCancelVisit,
  canCloseVisit,
  claimsToCsv,
  visitChargeAmount,
  type ClaimExportRow,
} from '@/lib/erp/hospital'
import { getPack } from '@/lib/packs'

describe('hospital billing helpers', () => {
  it('multiplies charge lines', () => {
    expect(visitChargeAmount('2', '50')).toBe('100.0000')
  })

  it('gates visit lifecycle', () => {
    expect(canAddVisitCharge('OPEN')).toBe(true)
    expect(canAddVisitCharge('CLOSED')).toBe(false)
    expect(canCloseVisit({ status: 'OPEN', chargeCount: 0 })).toBe(false)
    expect(canCloseVisit({ status: 'OPEN', chargeCount: 1 })).toBe(true)
    expect(canCancelVisit('OPEN')).toBe(true)
    expect(canCancelVisit('CLOSED')).toBe(false)
  })

  it('exports stable CSV claim shape', () => {
    const rows: ClaimExportRow[] = [
      {
        visitId: 'v1',
        patientName: 'Amina Ali',
        openedAt: '2026-11-07T10:00:00.000Z',
        closedAt: '2026-11-07T12:00:00.000Z',
        payerName: 'Self-pay',
        payerRef: null,
        department: 'OPD',
        invoiceNumber: 'INV-1',
        billCode: 'CONSULT',
        description: 'Consultation',
        quantity: '1',
        unitPrice: '25.0000',
        amount: '25.0000',
      },
    ]
    const csv = claimsToCsv(rows)
    expect(csv).toContain('visitId,patientName,openedAt')
    expect(csv).toContain('v1,Amina Ali')
    expect(csv).toContain('CONSULT,Consultation,1,25.0000,25.0000')
  })
})

describe('hospital_admin pack', () => {
  it('is vertical-ready with visits checklist', () => {
    const pack = getPack('hospital_admin')
    expect(pack?.verticalStatus).toBe('ready')
    expect(pack?.outOfScope.some((line) => /EMR/i.test(line))).toBe(true)
    expect(pack?.setupChecklist.some((row) => row.id === 'visits')).toBe(true)
  })
})
