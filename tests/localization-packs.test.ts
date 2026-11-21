import { describe, expect, it } from 'vitest'

import {
  LOCALIZATION_PACKS,
  buildEInvoiceStub,
  localizationPackById,
  localizationPackIdForCountry,
  vatBoxLabelsForPack,
} from '@/lib/localization/packs'
import { vatReturnToCsv, buildVatReturnBoxes } from '@/lib/statutory-exports'
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

const VAT_BOX_KEYS = ['box1', 'box2', 'box3', 'box4', 'box5'] as const

describe('localization packs', () => {
  it('each pack has VAT box labels, payroll headers, and tax seed', () => {
    for (const pack of LOCALIZATION_PACKS) {
      expect(pack.payrollCsvHeaders.length).toBeGreaterThan(10)
      expect(pack.taxSeed.rates.length).toBeGreaterThan(0)
      expect(pack.taxSeed.defaultCodeName).toBeTruthy()
      for (const key of VAT_BOX_KEYS) {
        expect(pack.vatBoxLabels[key]).toBeTruthy()
      }
    }
  })

  it('vat CSV uses dj pack labels', () => {
    const boxes = buildVatReturnBoxes({
      jurisdiction: 'DJ',
      from: '2026-01-01',
      to: '2026-01-31',
      salesNet: 100,
      salesTax: 10,
      purchaseNet: 50,
      purchaseTax: 5,
    })
    const csv = vatReturnToCsv(boxes, localizationPackById('dj')?.vatBoxLabels)
    expect(csv).toContain('Livraisons taxables')
    expect(csv).toContain('TVA nette due')
  })

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

  it('e-invoice stub carries supplier and buyer addresses', () => {
    const json = buildEInvoiceStub(
      {
        name: 'Supplier Co',
        taxRegistrationNumber: 'SUP-1',
        country: 'ET',
        localizationPackId: 'et',
        addressLine1: 'Bole Rd',
        city: 'Addis',
      },
      {
        number: 'INV-2',
        date: '2026-02-01',
        customerName: 'Buyer',
        total: '115.00',
        currencyCode: 'ETB',
        subtotal: '100.00',
        taxTotal: '15.00',
        buyerTaxId: 'BUY-9',
        buyerCountry: 'ET',
        buyerAddress: { line1: 'Piassa', city: 'Addis' },
        lines: [
          {
            sku: null,
            description: 'Service',
            quantity: '1',
            unitPrice: '100',
            net: '100',
            taxAmount: '15',
            taxCodeName: 'Standard',
          },
        ],
      },
    )
    const parsed = JSON.parse(json) as {
      supplier: { address: { line1: string; city: string } }
      invoice: { buyerAddress: { line1: string }; buyerTaxId: string }
      taxSummary: { byCode: { taxCode: string }[] }
    }
    expect(parsed.supplier.address.line1).toBe('Bole Rd')
    expect(parsed.invoice.buyerAddress.line1).toBe('Piassa')
    expect(parsed.invoice.buyerTaxId).toBe('BUY-9')
    expect(parsed.taxSummary.byCode[0]?.taxCode).toBe('Standard')
  })

  it('vatBoxLabelsForPack falls back when pack missing', () => {
    expect(vatBoxLabelsForPack('zz')?.box1).toContain('Taxable supplies')
    expect(vatBoxLabelsForPack('dj').box1).toContain('Livraisons')
  })
})