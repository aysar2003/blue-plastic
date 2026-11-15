import { describe, expect, it } from 'vitest'

import {
  buildEInvoiceStub,
  localizationPackById,
  localizationPackIdForCountry,
} from '@/lib/localization/packs'
import { payrollStatutoryToCsv, payrollStatutoryToCsvForPack, type PayrollStatutoryLine } from '@/lib/statutory-exports'

const row: PayrollStatutoryLine = {
  runId: 'r1',
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  payslipNumber: 'P1',
  employeeCode: 'E1',
  employeeName: 'Alex',
  department: 'Ops',
  gross: '100',
  deductions: '10',
  employer: '5',
  net: '90',
  lines: [{ code: 'TAX', label: 'Tax', kind: 'DED', amount: '10', affectsNet: true }],
}

describe('localization packs', () => {
  it('so vs ke payroll headers differ', () => {
    const so = payrollStatutoryToCsvForPack([row], 'so')
    const ke = payrollStatutoryToCsvForPack([row], 'ke')
    expect(so.split('\r\n')[0]).not.toBe(ke.split('\r\n')[0])
    expect(so).toContain('periodStart')
    expect(ke).toContain('pay_period_from')
  })

  it('default headers when no pack', () => {
    const csv = payrollStatutoryToCsv([row])
    expect(csv).toContain('periodStart')
  })

  it('maps country code to localization pack', () => {
    expect(localizationPackIdForCountry('SO')).toBe('so')
    expect(localizationPackIdForCountry(' ke ')).toBe('ke')
    expect(localizationPackIdForCountry('AE')).toBeNull()
    expect(localizationPackIdForCountry(null)).toBeNull()
  })

  it('seeds distinct tax rates and payroll headers per pack', () => {
    expect(localizationPackById('ke')?.taxSeed.rates[0]?.percent).toBe(16)
    expect(localizationPackById('et')?.taxSeed.rates[0]?.percent).toBe(15)
    expect(localizationPackById('dj')?.taxSeed.rates[0]?.percent).toBe(10)
    expect(localizationPackById('so')?.taxSeed.exemptDefault).toBe(true)
    const et = payrollStatutoryToCsvForPack([row], 'et')
    const dj = payrollStatutoryToCsvForPack([row], 'dj')
    expect(et.split('\r\n')[0]).toContain('period_from')
    expect(dj.split('\r\n')[0]).toContain('debut_periode')
  })

  it('e-invoice stub JSON parses', () => {
    const json = buildEInvoiceStub(
      { name: 'Acme', taxRegistrationNumber: 'T1', country: 'KE', localizationPackId: 'ke' },
      {
        number: 'INV-1',
        date: '2026-01-15',
        customerName: 'Buyer',
        total: '100.00',
        currencyCode: 'USD',
        taxTotal: '16.00',
        subtotal: '84.00',
        lines: [
          {
            sku: 'A1',
            description: 'Widget',
            quantity: '1',
            unitPrice: '84',
            net: '84',
            taxAmount: '16',
            taxCodeName: 'Standard',
          },
        ],
      },
    )
    const parsed = JSON.parse(json) as {
      packId: string
      invoice: { number: string }
      timsStatus?: string
      lines?: unknown[]
      taxSummary?: { taxTotal: string }
    }
    expect(parsed.packId).toBe('ke')
    expect(parsed.invoice.number).toBe('INV-1')
    expect(parsed.timsStatus).toBe('offline')
    expect(parsed.lines).toHaveLength(1)
    expect(parsed.taxSummary?.taxTotal).toBe('16.00')
    expect(localizationPackById('ke')?.country).toBe('KE')
  })
})