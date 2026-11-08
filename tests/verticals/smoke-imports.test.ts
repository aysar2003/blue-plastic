import { describe, expect, it } from 'vitest'

/**
 * Smoke: every vertical module loads without throwing (import graph / syntax).
 */
describe('vertical module smoke imports', () => {
  it('loads pharmacy helpers and pack', async () => {
    const pharmacy = await import('@/lib/erp/pharmacy')
    const packs = await import('@/lib/packs')
    expect(pharmacy.assertPharmacyIssue).toBeTypeOf('function')
    expect(packs.getPack('pharmacy')?.verticalStatus).toBe('ready')
  })

  it('loads education helpers and pack', async () => {
    const education = await import('@/lib/erp/education')
    const packs = await import('@/lib/packs')
    expect(education.canBillEnrollment).toBeTypeOf('function')
    expect(packs.getPack('school')?.verticalStatus).toBe('ready')
    expect(packs.getPack('university')?.verticalStatus).toBe('ready')
  })

  it('loads hospital helpers and pack', async () => {
    const hospital = await import('@/lib/erp/hospital')
    const packs = await import('@/lib/packs')
    expect(hospital.canCloseVisit).toBeTypeOf('function')
    expect(hospital.claimsToCsv([{ 
      visitId: 'v', patientName: 'p', openedAt: 't', closedAt: null,
      payerName: null, payerRef: null, department: null, invoiceNumber: null,
      billCode: null, description: 'd', quantity: '1', unitPrice: '1', amount: '1',
    }])).toContain('visitId')
    expect(packs.getPack('hospital_admin')?.verticalStatus).toBe('ready')
  })

  it('loads P5 helpers and packs', async () => {
    const p5 = await import('@/lib/erp/verticals-p5')
    const packs = await import('@/lib/packs')
    expect(p5.progressBillGross).toBeTypeOf('function')
    expect(p5.canReceiveAsn('EXPECTED')).toBe(true)
    for (const id of [
      'ngo',
      'professional_services',
      'construction',
      'manufacturing',
      'distribution',
      'hotel',
      'restaurant',
    ] as const) {
      expect(packs.getPack(id)?.verticalStatus, id).toBe('ready')
    }
  })

  it('loads hospitality helpers', async () => {
    const hotel = await import('@/lib/erp/hotel')
    const dining = await import('@/lib/erp/dining-table')
    expect(hotel.canCheckOutStay('CHECKED_IN')).toBe(true)
    expect(dining.canTransitionDiningTable('OPEN', 'SEATED')).toBe(true)
  })

  it('coverage summary has zero planned verticals', async () => {
    const { coverageSummary } = await import('@/lib/packs')
    const summary = coverageSummary()
    expect(summary.verticalPlanned).toBe(0)
    expect(summary.verticalReady).toBe(summary.total)
  })
})
