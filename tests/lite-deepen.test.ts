import { describe, expect, it, vi } from 'vitest'

import {
  assertTrustedExtension,
  mergedTrustedExtensions,
  trustedExtensionIds,
} from '@/lib/erp/extensions/registry'
import {
  dispatchSignWebhook,
  parseSignProvider,
  signWebhookBody,
  verifySignWebhookSignature,
} from '@/lib/erp/sign-provider'
import { buildEInvoiceStub } from '@/lib/localization/packs'
import { payrollStatutoryToCsvForPack, type PayrollStatutoryLine } from '@/lib/statutory-exports'

describe('lite deepen — sign provider HMAC', () => {
  it('signs and verifies webhook body', () => {
    const body = '{"event":"sign.request.sent","requestId":"r1"}'
    const sig = signWebhookBody('test-secret', body)
    expect(sig).toHaveLength(64)
    expect(verifySignWebhookSignature('test-secret', body, sig)).toBe(true)
    expect(verifySignWebhookSignature('wrong', body, sig)).toBe(false)
  })

  it('sends X-Som-Signature when secret configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: 'ext-2' }),
    })
    await dispatchSignWebhook(
      { kind: 'webhook', webhookUrl: 'https://hooks.example/sign', webhookSecret: 's3cr3t' },
      {
        requestId: 'r1',
        title: 'T',
        token: 'tok',
        signerEmail: null,
        organizationName: 'Org',
      },
      fetchMock as unknown as typeof fetch,
    )
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['X-Som-Signature']).toBeTruthy()
    expect(headers['content-type']).toBe('application/json')
  })

  it('parses webhook secret from org JSON', () => {
    expect(
      parseSignProvider({ kind: 'webhook', webhookUrl: 'https://x', webhookSecret: 'abc' }).webhookSecret,
    ).toBe('abc')
  })
})

describe('lite deepen — trusted extensions', () => {
  it('merges org allowlist with registry', () => {
    const merged = mergedTrustedExtensions([{ id: 'partner.reports', title: 'Partner reports' }])
    expect(trustedExtensionIds([{ id: 'partner.reports' }])).toContain('partner.reports')
    expect(() => assertTrustedExtension('partner.reports', [{ id: 'partner.reports' }])).not.toThrow()
    expect(merged.some((row) => row.id === 'som.mcp')).toBe(true)
  })
})

describe('lite deepen — localization', () => {
  it('e-invoice stub includes pack id', () => {
    const json = buildEInvoiceStub(
      { name: 'Co', taxRegistrationNumber: 'T1', country: 'SO', localizationPackId: 'so' },
      { number: 'INV-1', date: '2026-01-01', customerName: 'Buyer', total: '100', currencyCode: 'USD' },
    )
    const parsed = JSON.parse(json) as { packId: string | null }
    expect(parsed.packId).toBe('so')
  })

  it('payroll CSV uses pack headers', () => {
    const rows: PayrollStatutoryLine[] = [
      {
        runId: 'r',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        payslipNumber: 'PS-1',
        employeeCode: 'E1',
        employeeName: 'Sam',
        department: null,
        gross: '100',
        deductions: '10',
        employer: '5',
        net: '90',
        lines: [],
      },
    ]
    const csv = payrollStatutoryToCsvForPack(rows, 'so')
    expect(csv.split('\r\n')[0]).toContain('periodStart')
  })
})