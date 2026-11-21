/**
 * Machine-facing capability registry (Phase 22 / L9).
 *
 * Each entry names a permission, Zod input, HTTP surface, and the existing
 * service entrypoint that runs the work. Routes and MCP must not re-implement
 * domain rules — see ADR-0014.
 */

import { z } from 'zod'

import { calendarDate, cuid } from '@/lib/validation/common'
import { paymentSchema, salesDocumentSchema } from '@/lib/validation/sales'
import { purchaseDocumentSchema } from '@/lib/validation/purchases'
import type { Permission } from '@/lib/permissions-catalog'

export type CapabilityHttpMethod = 'GET' | 'POST'

export type CapabilityDef = {
  id: string
  title: string
  description: string
  /** World-ERP layer this capability serves. */
  layer: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L8' | 'L9'
  /** Operating loop label for readiness tests. */
  loop: 'sell' | 'collect' | 'buy' | 'stock' | 'books' | 'crm'
  permission: Permission
  method: CapabilityHttpMethod
  /** Absolute path under this app, e.g. /api/v1/ar/open */
  path: string
  input: z.ZodType
  /** service module export name — documentation / OpenAPI only; dispatch imports explicitly. */
  service: string
}

const emptyInput = z.object({}).strict()

export const arListOpenInput = emptyInput

export const stockOnHandInput = emptyInput

export const trialBalanceInput = z.object({
  from: calendarDate,
  to: calendarDate,
})

export const paymentCreateInput = paymentSchema

export const poCreateInput = purchaseDocumentSchema

export const customersListInput = emptyInput

export const serviceJobsListInput = emptyInput

export const invoicesListInput = z.object({
  q: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
  status: z.string().optional(),
  customerId: z.string().optional(),
  sort: z.string().optional(),
  dir: z.string().optional(),
})

export const invoicesCreateInput = salesDocumentSchema

export const serviceJobGetInput = z.object({
  id: cuid,
})

export const serviceJobCompleteInput = z.object({
  id: cuid,
})

export const crmBoardInput = emptyInput

export const mrpPlanInput = z.object({
  itemId: cuid,
  qty: z
    .string()
    .trim()
    .regex(/^\d{1,12}(\.\d{1,4})?$/, 'Enter a quantity')
    .optional(),
  fromDemand: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false'), z.literal('')])
    .optional(),
})

export const ERP_CAPABILITIES = [
  {
    id: 'ar.listOpen',
    title: 'List open receivables',
    description: 'Open and partially paid customer invoices with outstanding amounts.',
    layer: 'L3',
    loop: 'collect',
    permission: 'invoice:read',
    method: 'GET',
    path: '/api/v1/ar/open',
    input: arListOpenInput,
    service: 'bank-feed.openInvoices',
  },
  {
    id: 'payment.create',
    title: 'Record customer payment',
    description: 'Create a customer payment and apply it to open invoices.',
    layer: 'L3',
    loop: 'collect',
    permission: 'payment:create',
    method: 'POST',
    path: '/api/v1/payments',
    input: paymentCreateInput,
    service: 'payment.create',
  },
  {
    id: 'stock.onHand',
    title: 'Stock on hand',
    description: 'Inventory valuation / quantity on hand by item.',
    layer: 'L4',
    loop: 'stock',
    permission: 'item:read',
    method: 'GET',
    path: '/api/v1/stock/on-hand',
    input: stockOnHandInput,
    service: 'inventory.stockOnHand',
  },
  {
    id: 'po.create',
    title: 'Create purchase order',
    description: 'Create a purchase order (draft or submitted per saveAsDraft).',
    layer: 'L3',
    loop: 'buy',
    permission: 'bill:create',
    method: 'POST',
    path: '/api/v1/purchase-orders',
    input: poCreateInput,
    service: 'purchase.create(PURCHASE_ORDER)',
  },
  {
    id: 'report.trialBalance',
    title: 'Trial balance',
    description: 'Trial balance for a calendar date range.',
    layer: 'L1',
    loop: 'books',
    permission: 'report:read',
    method: 'GET',
    path: '/api/v1/reports/trial-balance',
    input: trialBalanceInput,
    service: 'accounting.trialBalance',
  },
  {
    id: 'customers.list',
    title: 'List customers',
    description: 'Active customers with display name and open AR balance.',
    layer: 'L2',
    loop: 'sell',
    permission: 'customer:read',
    method: 'GET',
    path: '/api/v1/customers',
    input: customersListInput,
    service: 'contact.listCustomers',
  },
  {
    id: 'invoices.list',
    title: 'List invoices',
    description: 'Customer invoices (sales documents of type INVOICE).',
    layer: 'L3',
    loop: 'sell',
    permission: 'invoice:read',
    method: 'GET',
    path: '/api/v1/invoices',
    input: invoicesListInput,
    service: 'sales.list(INVOICE)',
  },
  {
    id: 'invoices.create',
    title: 'Create invoice',
    description: 'Create a customer invoice (draft or posted per saveAsDraft).',
    layer: 'L3',
    loop: 'sell',
    permission: 'invoice:create',
    method: 'POST',
    path: '/api/v1/invoices',
    input: invoicesCreateInput,
    service: 'sales.create(INVOICE)',
  },
  {
    id: 'serviceJobs.list',
    title: 'List service jobs',
    description: 'Field / van service jobs (FSM lite).',
    layer: 'L3',
    loop: 'sell',
    permission: 'invoice:read',
    method: 'GET',
    path: '/api/v1/service-jobs',
    input: serviceJobsListInput,
    service: 'service-job.list',
  },
  {
    id: 'serviceJobs.get',
    title: 'Get service job',
    description: 'One field / van service job by id, including lines.',
    layer: 'L3',
    loop: 'sell',
    permission: 'invoice:read',
    method: 'GET',
    path: '/api/v1/service-jobs/get',
    input: serviceJobGetInput,
    service: 'service-job.get',
  },
  {
    id: 'serviceJobs.complete',
    title: 'Complete service job',
    description: 'Complete a scheduled job (invoice + COGS, van stock issue).',
    layer: 'L3',
    loop: 'sell',
    permission: 'invoice:create',
    method: 'POST',
    path: '/api/v1/service-jobs/complete',
    input: serviceJobCompleteInput,
    service: 'service-job.complete',
  },
  {
    id: 'crm.board',
    title: 'CRM pipeline board',
    description: 'Opportunities and follow-up activities.',
    layer: 'L6',
    loop: 'crm',
    permission: 'customer:read',
    method: 'GET',
    path: '/api/v1/crm/board',
    input: crmBoardInput,
    service: 'crm.listBoard',
  },
  {
    id: 'mrp.materialsPlan',
    title: 'Materials plan',
    description: 'BOM explode + shortage vs on-hand; optional qty from open sales demand.',
    layer: 'L5',
    loop: 'stock',
    permission: 'inventory:read',
    method: 'GET',
    path: '/api/v1/mrp/plan',
    input: mrpPlanInput,
    service: 'assembly-build.materialsPlan',
  },
] as const satisfies readonly CapabilityDef[]

export type CapabilityId = (typeof ERP_CAPABILITIES)[number]['id']

export function capabilityById(id: string): CapabilityDef | undefined {
  return ERP_CAPABILITIES.find((c) => c.id === id)
}

export function capabilityByPath(method: string, path: string): CapabilityDef | undefined {
  const normalised = path.replace(/\/$/, '') || '/'
  return ERP_CAPABILITIES.find(
    (c) => c.method === method.toUpperCase() && c.path === normalised,
  )
}

/** Permissions a key may be granted — union of capability permissions. */
export function capabilityPermissionUniverse(): Permission[] {
  const set = new Set<Permission>()
  for (const c of ERP_CAPABILITIES) set.add(c.permission)
  return [...set]
}
