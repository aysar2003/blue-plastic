/**
 * OpenAPI 3 document generated from the capability registry.
 * Kept isomorphic so tests can assert sync without importing server code.
 */

import { ERP_CAPABILITIES } from '@/lib/erp/capabilities'
import { PRODUCT_NAME } from '@/lib/product-brand'

function zodToRoughSchema(capabilityId: string): Record<string, unknown> {
  // Structural placeholder — Zod → JSON Schema full conversion is out of scope.
  // Operation ids and paths are authoritative; request bodies are documented by title.
  switch (capabilityId) {
    case 'report.trialBalance':
      return {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
          to: { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
        },
      }
    case 'payment.create':
      return {
        type: 'object',
        required: ['customerId', 'date', 'amount', 'method', 'depositAccountId'],
        properties: {
          customerId: { type: 'string' },
          date: { type: 'string', format: 'date' },
          amount: { type: 'string' },
          method: { type: 'string' },
          depositAccountId: { type: 'string' },
          applications: { type: 'array', items: { type: 'object' } },
        },
      }
    case 'po.create':
      return {
        type: 'object',
        required: ['date', 'lines'],
        properties: {
          vendorId: { type: 'string' },
          date: { type: 'string', format: 'date' },
          lines: { type: 'array', items: { type: 'object' } },
        },
      }
    default:
      return { type: 'object', additionalProperties: false }
  }
}

export function buildOpenApiDocument(baseUrl = '') {
  const paths: Record<string, Record<string, unknown>> = {
    '/api/v1/capabilities': {
      get: {
        operationId: 'listCapabilities',
        summary: 'List machine capabilities',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Capability catalogue' },
          '401': { description: 'Missing or invalid API key' },
        },
      },
    },
    '/api/v1/mcp/tools': {
      get: {
        operationId: 'mcpListTools',
        summary: 'MCP tool descriptors (capability mirror)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Tool list' },
          '401': { description: 'Missing or invalid API key' },
        },
      },
    },
    '/api/v1/mcp/call': {
      post: {
        operationId: 'mcpCallTool',
        summary: 'Invoke a capability by id (MCP call)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  arguments: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Tool result' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Scope missing' },
        },
      },
    },
  }

  for (const cap of ERP_CAPABILITIES) {
    const pathKey = cap.path
    const op: Record<string, unknown> = {
      operationId: cap.id.replace(/\./g, '_'),
      summary: cap.title,
      description: `${cap.description} Requires permission \`${cap.permission}\`. Service: ${cap.service}.`,
      security: [{ bearerAuth: [] }],
      tags: [cap.layer, cap.loop],
      responses: {
        '200': { description: 'Success' },
        '401': { description: 'Unauthorized' },
        '403': { description: 'Forbidden — key lacks scope' },
        '422': { description: 'Validation failed' },
      },
    }

    if (cap.method === 'GET') {
      const schema = zodToRoughSchema(cap.id)
      const props = (schema.properties ?? {}) as Record<string, unknown>
      if (Object.keys(props).length > 0) {
        op.parameters = Object.entries(props).map(([name, prop]) => ({
          name,
          in: 'query',
          required: Array.isArray(schema.required) && schema.required.includes(name),
          schema: prop,
        }))
      }
    } else {
      op.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: zodToRoughSchema(cap.id),
          },
        },
      }
    }

    paths[pathKey] = { ...(paths[pathKey] ?? {}), [cap.method.toLowerCase()]: op }
  }

  return {
    openapi: '3.0.3',
    info: {
      title: `${PRODUCT_NAME} Machine API`,
      version: '1.0.0',
      description:
        'Thin adapters over the ERP service layer. Authenticate with an organisation API key (Bearer).',
    },
    servers: baseUrl ? [{ url: baseUrl }] : [{ url: '/' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Organisation API key (`som_…`) from Settings → API keys.',
        },
      },
    },
    paths,
  }
}

/** Paths that must appear in OpenAPI for every registered capability. */
export function openApiCapabilityPaths(): { id: string; method: string; path: string }[] {
  return ERP_CAPABILITIES.map((c) => ({
    id: c.id,
    method: c.method.toLowerCase(),
    path: c.path,
  }))
}
