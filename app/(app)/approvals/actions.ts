'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { action } from '@/server/action'
import * as approvalService from '@/server/services/approval.service'

const entityTypeSchema = z.enum([
  'SALES_DOCUMENT',
  'PURCHASE_DOCUMENT',
  'CUSTOMER_PAYMENT',
  'BILL_PAYMENT',
  'JOURNAL',
  'INVENTORY_ADJUSTMENT',
  'BANK_TRANSFER',
  'DEPOSIT',
  'CUSTOMER',
  'VENDOR',
])

export const decideApproval = action
  .requires('org:read')
  .input(
    z.object({
      requestId: z.string().min(1),
      decision: z.enum(['APPROVED', 'REJECTED']),
      note: z.string().max(500).optional().nullable(),
    }),
  )
  .handler(async (ctx, input) => {
    const result = await approvalService.decide(ctx, input)
    revalidatePath('/approvals')
    revalidatePath('/sales', 'layout')
    revalidatePath('/purchases', 'layout')
    revalidatePath('/payments', 'layout')
    revalidatePath('/bill-payments', 'layout')
    revalidatePath('/banking', 'layout')
    revalidatePath('/journals', 'layout')
    revalidatePath('/inventory', 'layout')
    revalidatePath('/customers', 'layout')
    revalidatePath('/vendors', 'layout')
    return result
  })

export const createApprovalPolicy = action
  .requires('org:update')
  .input(
    z.object({
      name: z.string().min(1).max(120),
      entityType: entityTypeSchema,
      documentKind: z.string().max(40).nullable().optional(),
      enabled: z.boolean().optional(),
      minAmount: z.union([z.string(), z.number()]).optional(),
      maxAmount: z.union([z.string(), z.number(), z.null()]).optional(),
      priority: z.coerce.number().int().min(1).max(9999).optional(),
      requireDifferentApprover: z.boolean().optional(),
      levels: z.coerce.number().int().min(1).max(3).optional(),
    }),
  )
  .handler(async (ctx, input) => {
    const policy = await approvalService.createPolicy(ctx, input)
    revalidatePath('/approvals')
    return policy
  })

export const updateApprovalPolicy = action
  .requires('org:update')
  .input(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1).max(120),
      documentKind: z.string().max(40).nullable().optional(),
      enabled: z.boolean(),
      minAmount: z.union([z.string(), z.number()]),
      maxAmount: z.union([z.string(), z.number(), z.null()]).optional(),
      priority: z.coerce.number().int().min(1).max(9999),
      requireDifferentApprover: z.boolean(),
      levels: z.coerce.number().int().min(1).max(3),
    }),
  )
  .handler(async (ctx, input) => {
    const policy = await approvalService.updatePolicy(ctx, input)
    revalidatePath('/approvals')
    return policy
  })

export const deleteApprovalPolicy = action
  .requires('org:update')
  .input(z.object({ id: z.string().min(1) }))
  .handler(async (ctx, input) => {
    const result = await approvalService.deletePolicy(ctx, input.id)
    revalidatePath('/approvals')
    return result
  })
