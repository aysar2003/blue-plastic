/**
 * MCP-ready tool descriptors — one mirror of ERP_CAPABILITIES.
 * Agents list tools here, then POST /api/v1/mcp/call with the same ids.
 */

import { ERP_CAPABILITIES, type CapabilityDef } from '@/lib/erp/capabilities'

export type McpToolDescriptor = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations: {
    permission: string
    layer: string
    loop: string
    httpMethod: string
    httpPath: string
  }
}

function inputSchemaFor(cap: CapabilityDef): Record<string, unknown> {
  switch (cap.id) {
    case 'report.trialBalance':
      return {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string', description: 'Start date YYYY-MM-DD' },
          to: { type: 'string', description: 'End date YYYY-MM-DD' },
        },
      }
    case 'payment.create':
      return {
        type: 'object',
        required: ['customerId', 'date', 'amount', 'method', 'depositAccountId'],
        properties: {
          customerId: { type: 'string' },
          date: { type: 'string' },
          amount: { type: 'string' },
          method: { type: 'string' },
          depositAccountId: { type: 'string' },
          applications: { type: 'array' },
        },
      }
    case 'po.create':
      return {
        type: 'object',
        required: ['date', 'lines'],
        properties: {
          vendorId: { type: 'string' },
          date: { type: 'string' },
          lines: { type: 'array' },
          saveAsDraft: { type: 'boolean' },
        },
      }
    default:
      return { type: 'object', properties: {}, additionalProperties: false }
  }
}

export function mcpToolDescriptors(): McpToolDescriptor[] {
  return ERP_CAPABILITIES.map((cap) => ({
    name: cap.id,
    description: `${cap.title}. ${cap.description}`,
    inputSchema: inputSchemaFor(cap),
    annotations: {
      permission: cap.permission,
      layer: cap.layer,
      loop: cap.loop,
      httpMethod: cap.method,
      httpPath: cap.path,
    },
  }))
}
