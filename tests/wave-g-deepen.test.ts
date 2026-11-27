import { describe, expect, it } from 'vitest'

import {
  computePayeForPack,
  employeePensionAmount,
  employerPensionAmount,
  payePackById,
} from '@/lib/erp/paye-packs'
import {
  extractInvoiceHint,
  extractPartyRef,
  isMobileMoneyStatement,
  suggestInvoiceMatches,
} from '@/lib/erp/mobile-money-match'
import {
  applyStatementPackRow,
  statementFormatPackById,
} from '@/lib/erp/statement-import-packs'
import {
  computeWithholdAmount,
  netPayableAfterWithhold,
  whtRateForPack,
  whtRemittanceCsv,
} from '@/lib/erp/withholding'
import { eInvoiceAdapterFor, buildEInvoicePayload } from '@/lib/localization/e-invoice-adapter'
import { money } from '@/lib/money'

describe('Wave G — mobile money match', () => {
  it('extracts party and invoice hints from MM narration', () => {
    expect(extractPartyRef('EVC from 252612345678 INV-1001')).toBe('252612345678')
    expect(extractInvoiceHint('Payment for INV-1001', null)).toBe('1001')
    expect(isMobileMoneyStatement({ description: 'M-Pesa Paybill' })).toBe(true)
    expect(isMobileMoneyStatement({ partyRef: '712345678' })).toBe(true)
  })

  it('scores exact outstanding matches with ref boost', () => {
    const suggestions = suggestInvoiceMatches(
      {
        amount: '150.00',
        description: 'Zaad INV-42 from 615551234',
        partyRef: '615551234',
      },
      [
        {
          id: 'a',
          number: 'INV-42',
          customerId: 'c1',
          outstanding: '150.00',
          partyRef: '615551234',
        },
        {
          id: 'b',
          number: 'INV-99',
          customerId: 'c2',
          outstanding: '150.00',
          partyRef: null,
        },
      ],
    )
    expect(suggestions[0]?.invoiceId).toBe('a')
    expect(suggestions[0]?.score).toBeGreaterThanOrEqual(85)
    expect(suggestions).toHaveLength(2)
  })

  it('adds et and mm statement packs with partyRef columns', () => {
    const mm = statementFormatPackById('mm')
    expect(mm.label).toMatch(/Mobile money/i)
    const row = applyStatementPackRow(
      { msisdn: '712345678', paidin: '100', transactiondate: '2026-11-01', details: 'Pay' },
      mm,
    )
    expect(row.partyref ?? row.msisdn).toBeTruthy()
    expect(statementFormatPackById('et').id).toBe('et')
  })
})

describe('Wave G — withholding tax', () => {
  it('computes WHT and net payable', () => {
    expect(whtRateForPack('et')?.percent).toBe(2)
    expect(computeWithholdAmount('1000', 2).toFixed(4)).toBe('20.0000')
    expect(netPayableAfterWithhold('1180', '20').toFixed(4)).toBe('1160.0000')
  })

  it('builds remittance CSV', () => {
    const csv = whtRemittanceCsv([
      {
        billNumber: 'BILL-1',
        billDate: '2026-11-01',
        vendorName: 'Import Co',
        baseAmount: '1000.0000',
        withholdPercent: '2.0000',
        withholdAmount: '20.0000',
        currencyCode: 'USD',
      },
    ])
    expect(csv.split('\r\n')[0]).toContain('Withhold amount')
    expect(csv).toContain('BILL-1')
  })
})

describe('Wave G — pack PAYE', () => {
  it('uses Somalia Law 37 monthly bands', () => {
    const pack = payePackById('so')
    expect(pack?.slabs).toHaveLength(4)
    // 200 → 0 on first 100 + 6% of 100 = 6
    expect(computePayeForPack('so', '200').toFixed(2)).toBe('6.00')
    // 800 → 0 + 6%*400 + 12%*300 = 24 + 36 = 60
    expect(computePayeForPack('so', '800').toFixed(2)).toBe('60.00')
  })

  it('applies Ethiopia pension percents', () => {
    expect(employeePensionAmount('et', '1000').toFixed(2)).toBe('70.00')
    expect(employerPensionAmount('et', '1000').toFixed(2)).toBe('110.00')
    expect(employeePensionAmount('so', '1000').eq(money(0))).toBe(true)
  })

  it('has Kenya progressive PAYE defaults', () => {
    expect(payePackById('ke')?.slabs[0]?.rate).toBe('10')
    expect(computePayeForPack('ke', '20000').toFixed(2)).toBe('2000.00')
  })
})

describe('Wave G — e-invoice adapter', () => {
  it('keeps stub for SO and shapes KE/ET offline payloads', () => {
    const org = {
      name: 'Test Co',
      taxRegistrationNumber: 'TIN',
      country: 'KE',
      localizationPackId: 'ke',
    }
    const invoice = {
      number: 'INV-1',
      date: '2026-11-01',
      customerName: 'Buyer',
      total: '100',
      currencyCode: 'KES',
    }
    expect(eInvoiceAdapterFor('so').mode).toBe('stub')
    expect(eInvoiceAdapterFor('ke').mode).toBe('tims-shaped')
    expect(eInvoiceAdapterFor('et').mode).toBe('et-shaped')
    const ke = buildEInvoicePayload(org, invoice)
    expect(ke.mode).toBe('tims-shaped')
    expect(ke.json).toContain('ke-tims-shaped')
    expect(ke.json).toContain('offline-stub')
  })
})
