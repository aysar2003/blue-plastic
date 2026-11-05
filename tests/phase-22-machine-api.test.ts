import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ERP_CAPABILITIES,
  capabilityById,
  capabilityByPath,
  capabilityPermissionUniverse,
} from '@/lib/erp/capabilities'
import { mcpToolDescriptors } from '@/lib/erp/mcp-tools'
import { buildOpenApiDocument, openApiCapabilityPaths } from '@/lib/erp/openapi'
import { ERP_LAYERS, ERP_READY_LOOPS } from '@/lib/erp/readiness'
import { isStaffPermission } from '@/lib/permissions-catalog'
import { displayPrefix, tokenLookup } from '@/lib/erp/api-key-token'

const root = process.cwd()

describe('Phase 22 — ERP layers', () => {
  it('declares L0–L9 with a known status', () => {
    expect(ERP_LAYERS.map((l) => l.id)).toEqual([
      'L0',
      'L1',
      'L2',
      'L3',
      'L4',
      'L5',
      'L6',
      'L7',
      'L8',
      'L9',
    ])
    for (const layer of ERP_LAYERS) {
      expect(['complete', 'lite', 'missing']).toContain(layer.status)
    }
    expect(ERP_LAYERS.find((l) => l.id === 'L9')?.status).toBe('complete')
  })

  it('keeps operating loops while layers deepen the product', () => {
    expect(ERP_READY_LOOPS).toHaveLength(9)
  })
})

describe('Phase 22 — capability registry ↔ OpenAPI ↔ MCP', () => {
  it('registers the five starter capabilities with valid permissions', () => {
    expect(ERP_CAPABILITIES.map((c) => c.id).sort()).toEqual(
      ['ar.listOpen', 'payment.create', 'po.create', 'report.trialBalance', 'stock.onHand'].sort(),
    )
    for (const cap of ERP_CAPABILITIES) {
      expect(isStaffPermission(cap.permission)).toBe(true)
      expect(cap.path.startsWith('/api/v1/')).toBe(true)
      expect(capabilityById(cap.id)?.path).toBe(cap.path)
      expect(capabilityByPath(cap.method, cap.path)?.id).toBe(cap.id)
    }
  })

  it('OpenAPI paths include every capability operation', () => {
    const doc = buildOpenApiDocument()
    const listed = openApiCapabilityPaths()
    for (const item of listed) {
      const pathItem = doc.paths[item.path] as Record<string, unknown> | undefined
      expect(pathItem, item.path).toBeTruthy()
      expect(pathItem?.[item.method], `${item.method} ${item.path}`).toBeTruthy()
    }
    expect(doc.paths['/api/v1/capabilities']).toBeTruthy()
    expect(doc.paths['/api/v1/mcp/tools']).toBeTruthy()
    expect(doc.paths['/api/v1/mcp/call']).toBeTruthy()
  })

  it('MCP tools mirror capability ids, permissions, and HTTP paths', () => {
    const tools = mcpToolDescriptors()
    expect(tools.map((t) => t.name).sort()).toEqual(ERP_CAPABILITIES.map((c) => c.id).sort())
    for (const tool of tools) {
      const cap = capabilityById(tool.name)
      expect(cap).toBeTruthy()
      expect(tool.annotations.permission).toBe(cap!.permission)
      expect(tool.annotations.httpPath).toBe(cap!.path)
      expect(tool.annotations.httpMethod).toBe(cap!.method)
      expect(tool.annotations.loop).toBe(cap!.loop)
    }
  })

  it('covers one capability per ready loop used by the machine surface', () => {
    const loops = new Set(ERP_CAPABILITIES.map((c) => c.loop))
    for (const loop of ['collect', 'buy', 'stock', 'books'] as const) {
      expect(loops.has(loop), loop).toBe(true)
    }
  })

  it('ships route adapters and settings UI for API keys', () => {
    const required = [
      'app/api/v1/openapi/route.ts',
      'app/api/v1/capabilities/route.ts',
      'app/api/v1/ar/open/route.ts',
      'app/api/v1/stock/on-hand/route.ts',
      'app/api/v1/payments/route.ts',
      'app/api/v1/purchase-orders/route.ts',
      'app/api/v1/reports/trial-balance/route.ts',
      'app/api/v1/mcp/tools/route.ts',
      'app/api/v1/mcp/call/route.ts',
      'app/(app)/settings/(work)/api-keys/page.tsx',
      'docs/06-erp-layers.md',
      'docs/decisions/0014-machine-api-single-service.md',
      'docs/phases/phase-22-platform-ai.md',
      'prisma/migrations/20261105140000_api_keys/migration.sql',
    ]
    for (const relative of required) {
      expect(existsSync(join(root, relative)), relative).toBe(true)
    }
  })
})

describe('Phase 22 — API key token helpers (authz shape)', () => {
  it('derives a stable lookup and short prefix from a som_ token', () => {
    const token = 'som_testtokenvalue0123456789abcdef'
    const a = tokenLookup(token)
    const b = tokenLookup(token)
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
    expect(displayPrefix(token)).toBe('som_testtoke')
    expect(capabilityPermissionUniverse().length).toBeGreaterThanOrEqual(4)
  })

  it('refuses unknown capability ids at the registry boundary', () => {
    expect(capabilityById('nope.missing')).toBeUndefined()
  })
})
