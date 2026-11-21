import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ERP_CAPABILITIES, capabilityById, capabilityByPath } from '@/lib/erp/capabilities'
import { probeTrustedExtension } from '@/lib/erp/extensions/probe'
import { assertTrustedExtension } from '@/lib/erp/extensions/registry'
import { mcpToolDescriptors } from '@/lib/erp/mcp-tools'
import { buildOpenApiDocument } from '@/lib/erp/openapi'
import {
  inboundEventType,
  mapInboundSignStatus,
  parseInboundSignWebhookPayload,
  signWebhookBody,
  verifySignWebhookSignature,
} from '@/lib/erp/sign-provider'
import {
  liveYearWindowLabel,
  REPORT_PACK_LIVE_YEAR_WARNING,
} from '@/lib/erp/scale-ops'
import { CYCLE_PATH } from '../e2e/helpers'

const root = process.cwd()

describe('wave F — Playwright cycle path', () => {
  it('documents sell → pay → buy → stock → recon → close', () => {
    expect(CYCLE_PATH.map((s) => s.name)).toEqual([
      'sell',
      'sell-invoices',
      'pay',
      'buy',
      'stock',
      'recon',
      'close',
    ])
    expect(existsSync(join(root, 'e2e/cycle-smoke.spec.ts'))).toBe(true)
    const spec = readFileSync(join(root, 'e2e/cycle-smoke.spec.ts'), 'utf8')
    expect(spec).toContain('E2E_EMAIL')
    expect(spec).toContain('/periods')
  })
})

describe('wave F — trading API capabilities', () => {
  it('registers invoices list/create, stock on hand, payments, job get/complete', () => {
    for (const id of [
      'invoices.list',
      'invoices.create',
      'payment.create',
      'stock.onHand',
      'serviceJobs.get',
      'serviceJobs.complete',
    ] as const) {
      expect(capabilityById(id)?.id).toBe(id)
    }
    expect(capabilityByPath('GET', '/api/v1/invoices')?.id).toBe('invoices.list')
    expect(capabilityByPath('POST', '/api/v1/invoices')?.id).toBe('invoices.create')
    expect(capabilityByPath('GET', '/api/v1/service-jobs/get')?.id).toBe('serviceJobs.get')
    expect(capabilityByPath('POST', '/api/v1/service-jobs/complete')?.id).toBe(
      'serviceJobs.complete',
    )
  })

  it('mirrors new caps in OpenAPI and MCP', () => {
    const doc = buildOpenApiDocument()
    expect(doc.paths['/api/v1/invoices']?.get).toBeTruthy()
    expect(doc.paths['/api/v1/invoices']?.post).toBeTruthy()
    expect(doc.paths['/api/v1/service-jobs/get']?.get).toBeTruthy()
    expect(doc.paths['/api/v1/service-jobs/complete']?.post).toBeTruthy()
    const names = mcpToolDescriptors().map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['invoices.list', 'serviceJobs.complete']))
    expect(names.sort()).toEqual(ERP_CAPABILITIES.map((c) => c.id).sort())
  })

  it('ships route adapters', () => {
    for (const relative of [
      'app/api/v1/invoices/route.ts',
      'app/api/v1/payments/route.ts',
      'app/api/v1/stock/on-hand/route.ts',
      'app/api/v1/service-jobs/get/route.ts',
      'app/api/v1/service-jobs/complete/route.ts',
      'app/api/webhooks/sign/route.ts',
      'app/api/v1/extensions/probe/route.ts',
      'prisma/migrations/20261121202000_wave_f_deepen/migration.sql',
    ]) {
      expect(existsSync(join(root, relative)), relative).toBe(true)
    }
  })
})

describe('wave F — inbound sign webhook mapping', () => {
  it('maps provider status onto signed / declined', () => {
    expect(mapInboundSignStatus('signed')).toBe('SIGNED')
    expect(mapInboundSignStatus('Completed')).toBe('SIGNED')
    expect(mapInboundSignStatus('declined')).toBe('DECLINED')
    expect(mapInboundSignStatus('rejected')).toBe('DECLINED')
    expect(mapInboundSignStatus('nope')).toBeNull()
    expect(inboundEventType('SIGNED')).toBe('inbound.signed')
    expect(inboundEventType(null)).toBe('inbound.unknown')
  })

  it('parses inbound payload aliases', () => {
    const parsed = parseInboundSignWebhookPayload({
      id: 'req-1',
      event: 'signed',
      providerId: 'ext-9',
      organizationId: 'org-1',
    })
    expect(parsed?.requestId).toBe('req-1')
    expect(parsed?.externalId).toBe('ext-9')
    expect(parsed?.orgId).toBe('org-1')
    expect(mapInboundSignStatus(parsed!.status)).toBe('SIGNED')
  })

  it('HMAC still verifies inbound bodies', () => {
    const body = '{"status":"signed","requestId":"r1"}'
    const sig = signWebhookBody('wave-f-secret', body)
    expect(verifySignWebhookSignature('wave-f-secret', body, `sha256=${sig}`)).toBe(true)
    expect(verifySignWebhookSignature('wave-f-secret', body, 'deadbeef')).toBe(false)
  })
})

describe('wave F — extensions probe + scale checklist', () => {
  it('probes first-party and org allowlist ids', () => {
    const ok = probeTrustedExtension('som.mcp')
    expect(ok.trusted).toBe(true)
    expect(ok.capabilities.length).toBeGreaterThan(0)
    expect(probeTrustedExtension('evil.plugin').trusted).toBe(false)
    expect(() =>
      assertTrustedExtension('partner.reports', [{ id: 'partner.reports', title: 'Partner' }]),
    ).not.toThrow()
    const partner = probeTrustedExtension('partner.reports', [
      { id: 'partner.reports', title: 'Partner' },
    ])
    expect(partner.trusted).toBe(true)
  })

  it('names the live-year window and report-pack warning', () => {
    expect(liveYearWindowLabel(2022, 2026, 5)).toBe('FY 2022–2026 (5-year live window)')
    expect(REPORT_PACK_LIVE_YEAR_WARNING).toMatch(/live fiscal years/i)
  })
})

describe('wave F — duplicate 20261119200000 migration timestamp', () => {
  it('leaves both folders named as applied (do not rename)', () => {
    const dir = join(root, 'prisma/migrations')
    const pair = readdirSync(dir).filter((name) => name.startsWith('20261119200000_'))
    expect(pair.sort()).toEqual([
      '20261119200000_fiscal_year_start_day',
      '20261119200000_project_task_tree_gantt',
    ])
    const note = readFileSync(join(root, 'docs/deepen-waves-plan.md'), 'utf8')
    expect(note).toMatch(/already applied/i)
  })
})
