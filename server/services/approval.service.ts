/**
 * Document approvals — international maker-checker (SOX / COSO segregation of duties).
 *
 * Custom workflows: many named rules per document family. First enabled match by
 * priority (then higher minAmount) wins for the amount band [min, max).
 *
 * When enabled for the company:
 *  1. Maker saves a posting document → PENDING_APPROVAL + ApprovalRequest
 *  2. Checker Approve → post to ledger; Reject → DRAFT
 *  3. POS till sales still post immediately
 */
import type { ApprovalEntityType, ApprovalRequestStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/client'

import { forbidden, notFound, precondition, validation } from '@/server/errors'
import type { OrgContext } from '@/server/auth/context'
import type { Permission } from '@/server/auth/permissions'
import { db, type Tx } from '@/server/db'
import { requestMeta, writeAudit } from '@/server/audit'
import { APPROVAL_ENTITY_TYPES, entityTypeLabel } from '@/lib/approval-labels'

const DEFAULT_ENTITY_TYPES = APPROVAL_ENTITY_TYPES

const APPROVE_PERMISSION: Partial<Record<ApprovalEntityType, Permission>> = {
  SALES_DOCUMENT: 'invoice:approve',
  PURCHASE_DOCUMENT: 'bill:approve',
  CUSTOMER_PAYMENT: 'payment:approve',
  BILL_PAYMENT: 'expense:approve',
  JOURNAL: 'journal:approve',
  INVENTORY_ADJUSTMENT: 'inventory:approve',
  BANK_TRANSFER: 'bank:approve',
  DEPOSIT: 'bank:approve',
  CUSTOMER: 'customer:approve',
  VENDOR: 'vendor:approve',
}

export function approvalsEnabled(ctx: OrgContext): boolean {
  return ctx.features.enableDocumentApprovals === true
}

type DbLike = Tx | typeof db

/** Seed one default workflow per family if the company has none for that type. */
export async function ensureDefaultPolicies(ctx: OrgContext, tx: DbLike = db) {
  for (const entityType of DEFAULT_ENTITY_TYPES) {
    const count = await tx.approvalPolicy.count({
      where: { orgId: ctx.orgId, entityType },
    })
    if (count > 0) continue
    await tx.approvalPolicy.create({
      data: {
        orgId: ctx.orgId,
        name: `${entityTypeLabel(entityType)} — default`,
        entityType,
        enabled: true,
        minAmount: new Decimal(0),
        maxAmount: null,
        priority: 100,
        requireDifferentApprover: true,
        levels: 1,
      },
    })
  }
}

export async function listPolicies(ctx: OrgContext) {
  await ensureDefaultPolicies(ctx)
  return db.approvalPolicy.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ entityType: 'asc' }, { priority: 'asc' }, { minAmount: 'desc' }],
  })
}

function parseAmount(raw: string | number | null | undefined, label: string): Decimal | null {
  if (raw == null || raw === '') return null
  const value = new Decimal(raw)
  if (value.isNegative()) throw validation(`${label} cannot be negative.`)
  return value
}

export async function createPolicy(
  ctx: OrgContext,
  input: {
    name: string
    entityType: ApprovalEntityType
    enabled?: boolean
    minAmount?: string | number
    maxAmount?: string | number | null
    priority?: number
    requireDifferentApprover?: boolean
    levels?: number
  },
) {
  const name = input.name.trim()
  if (!name) throw validation('Give the workflow a name.', { name: ['Required'] })
  const minAmount = parseAmount(input.minAmount ?? 0, 'Minimum amount') ?? new Decimal(0)
  const maxAmount = parseAmount(input.maxAmount ?? null, 'Maximum amount')
  if (maxAmount && maxAmount.lessThanOrEqualTo(minAmount)) {
    throw validation('Maximum must be greater than minimum.')
  }
  const levels = Math.min(3, Math.max(1, Math.floor(input.levels ?? 1)))
  const priority = Math.max(1, Math.floor(input.priority ?? 100))

  return db.approvalPolicy.create({
    data: {
      orgId: ctx.orgId,
      name,
      entityType: input.entityType,
      enabled: input.enabled !== false,
      minAmount,
      maxAmount,
      priority,
      requireDifferentApprover: input.requireDifferentApprover !== false,
      levels,
    },
  })
}

export async function updatePolicy(
  ctx: OrgContext,
  input: {
    id: string
    name: string
    enabled: boolean
    minAmount: string | number
    maxAmount?: string | number | null
    priority: number
    requireDifferentApprover: boolean
    levels: number
  },
) {
  const existing = await db.approvalPolicy.findFirst({
    where: { id: input.id, orgId: ctx.orgId },
  })
  if (!existing) throw notFound('Approval rule')

  const name = input.name.trim()
  if (!name) throw validation('Give the workflow a name.', { name: ['Required'] })
  const minAmount = parseAmount(input.minAmount, 'Minimum amount') ?? new Decimal(0)
  const maxAmount = parseAmount(input.maxAmount ?? null, 'Maximum amount')
  if (maxAmount && maxAmount.lessThanOrEqualTo(minAmount)) {
    throw validation('Maximum must be greater than minimum.')
  }
  const levels = Math.min(3, Math.max(1, Math.floor(input.levels)))
  const priority = Math.max(1, Math.floor(input.priority))

  return db.approvalPolicy.update({
    where: { id: existing.id },
    data: {
      name,
      enabled: input.enabled,
      minAmount,
      maxAmount,
      priority,
      requireDifferentApprover: input.requireDifferentApprover,
      levels,
    },
  })
}

export async function deletePolicy(ctx: OrgContext, id: string) {
  const existing = await db.approvalPolicy.findFirst({
    where: { id, orgId: ctx.orgId },
  })
  if (!existing) throw notFound('Approval rule')

  const siblings = await db.approvalPolicy.count({
    where: { orgId: ctx.orgId, entityType: existing.entityType },
  })
  if (siblings <= 1) {
    throw precondition(
      'Keep at least one rule for this document type, or turn the rule off instead of deleting it.',
    )
  }

  await db.approvalPolicy.delete({ where: { id: existing.id } })
  return { id: existing.id }
}

function amountInBand(value: Decimal, minAmount: Decimal, maxAmount: Decimal | null): boolean {
  if (value.lessThan(minAmount)) return false
  if (maxAmount != null && value.greaterThanOrEqualTo(maxAmount)) return false
  return true
}

/**
 * True when this posting must wait in the inbox instead of hitting the ledger.
 * Picks the first matching enabled workflow (priority, then higher floor).
 */
export async function needsApproval(
  ctx: OrgContext,
  entityType: ApprovalEntityType,
  amount: Decimal | string | number,
  tx: DbLike = db,
): Promise<{ required: boolean; levels: number; requireDifferentApprover: boolean; policyId?: string }> {
  if (!approvalsEnabled(ctx)) {
    return { required: false, levels: 1, requireDifferentApprover: true }
  }
  await ensureDefaultPolicies(ctx, tx)
  const value = amount instanceof Decimal ? amount : new Decimal(amount || 0)
  const policies = await tx.approvalPolicy.findMany({
    where: { orgId: ctx.orgId, entityType, enabled: true },
    orderBy: [{ priority: 'asc' }, { minAmount: 'desc' }],
  })

  for (const policy of policies) {
    if (!amountInBand(value, policy.minAmount, policy.maxAmount)) continue
    return {
      required: true,
      levels: policy.levels,
      requireDifferentApprover: policy.requireDifferentApprover,
      policyId: policy.id,
    }
  }

  return { required: false, levels: 1, requireDifferentApprover: true }
}

export async function submitRequest(
  tx: DbLike,
  ctx: OrgContext,
  input: {
    entityType: ApprovalEntityType
    entityId: string
    title: string
    href: string
    amount?: Decimal | string | number | null
    currencyCode?: string | null
    note?: string | null
    levels?: number
  },
) {
  await tx.approvalRequest.updateMany({
    where: {
      orgId: ctx.orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      status: 'PENDING',
    },
    data: { status: 'CANCELLED', decidedAt: new Date() },
  })

  const amount =
    input.amount == null || input.amount === ''
      ? null
      : input.amount instanceof Decimal
        ? input.amount
        : new Decimal(input.amount)

  const request = await tx.approvalRequest.create({
    data: {
      orgId: ctx.orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      href: input.href,
      amount,
      currencyCode: input.currencyCode ?? ctx.organization.baseCurrency,
      status: 'PENDING',
      currentLevel: 1,
      requiredLevels: input.levels ?? 1,
      note: input.note ?? null,
      submittedById: ctx.userId,
    },
  })

  await writeAudit(
    tx,
    ctx,
    {
      entity: 'ApprovalRequest',
      entityId: request.id,
      action: 'SUBMIT',
      after: {
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        amount: amount?.toString() ?? null,
      },
    },
    await requestMeta(),
  )

  return request
}

export async function listPending(ctx: OrgContext) {
  return db.approvalRequest.findMany({
    where: { orgId: ctx.orgId, status: 'PENDING' },
    orderBy: { submittedAt: 'desc' },
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
      decisions: {
        orderBy: { level: 'asc' },
        include: { decidedBy: { select: { id: true, name: true } } },
      },
    },
  })
}

export async function listRecent(ctx: OrgContext, take = 40) {
  return db.approvalRequest.findMany({
    where: { orgId: ctx.orgId, status: { in: ['APPROVED', 'REJECTED', 'CANCELLED'] } },
    orderBy: { decidedAt: 'desc' },
    take,
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
      decisions: {
        orderBy: { level: 'asc' },
        include: { decidedBy: { select: { id: true, name: true } } },
      },
    },
  })
}

function canDecide(ctx: OrgContext, entityType: ApprovalEntityType): boolean {
  const perm = APPROVE_PERMISSION[entityType]
  if (!perm) return false
  return ctx.permissions.has(perm)
}

function maySelfApprove(ctx: OrgContext): boolean {
  return ctx.role === 'OWNER' || ctx.role === 'ADMIN'
}

export async function decide(
  ctx: OrgContext,
  input: { requestId: string; decision: 'APPROVED' | 'REJECTED'; note?: string | null },
) {
  if (!approvalsEnabled(ctx)) {
    throw precondition('Document approvals are switched off for this company.')
  }

  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const request = await tx.approvalRequest.findFirst({
      where: { id: input.requestId, orgId: ctx.orgId },
    })
    if (!request) throw notFound('Approval request')
    if (request.status !== 'PENDING') {
      throw precondition('This request has already been decided.')
    }
    if (!canDecide(ctx, request.entityType)) {
      throw forbidden('You are not allowed to approve this type of document.')
    }

    const policies = await tx.approvalPolicy.findMany({
      where: { orgId: ctx.orgId, entityType: request.entityType, enabled: true },
      orderBy: [{ priority: 'asc' }, { minAmount: 'desc' }],
    })
    const amount = request.amount ?? new Decimal(0)
    const matched = policies.find((p) => amountInBand(amount, p.minAmount, p.maxAmount))
    const requireDifferent = matched?.requireDifferentApprover ?? true

    if (requireDifferent && request.submittedById === ctx.userId && !maySelfApprove(ctx)) {
      throw forbidden(
        'Segregation of duties: the person who submitted cannot approve. Ask another authorised user.',
      )
    }

    const decisionStatus: ApprovalRequestStatus = input.decision

    await tx.approvalDecision.create({
      data: {
        requestId: request.id,
        orgId: ctx.orgId,
        level: request.currentLevel,
        decision: decisionStatus,
        note: input.note ?? null,
        decidedById: ctx.userId,
      },
    })

    if (input.decision === 'REJECTED') {
      await tx.approvalRequest.update({
        where: { id: request.id },
        data: { status: 'REJECTED', decidedAt: new Date() },
      })
      await revertEntityToDraft(tx, ctx, request.entityType, request.entityId)
      await writeAudit(
        tx,
        ctx,
        {
          entity: 'ApprovalRequest',
          entityId: request.id,
          action: 'REJECT',
          after: { note: input.note ?? null },
        },
        meta,
      )
      return { id: request.id, status: 'REJECTED' as const }
    }

    if (request.currentLevel < request.requiredLevels) {
      await tx.approvalRequest.update({
        where: { id: request.id },
        data: { currentLevel: request.currentLevel + 1 },
      })
      await writeAudit(
        tx,
        ctx,
        {
          entity: 'ApprovalRequest',
          entityId: request.id,
          action: 'APPROVE',
          after: { level: request.currentLevel, moreLevels: true },
        },
        meta,
      )
      return { id: request.id, status: 'PENDING' as const }
    }

    await tx.approvalRequest.update({
      where: { id: request.id },
      data: { status: 'APPROVED', decidedAt: new Date() },
    })

    await postApprovedEntity(tx, ctx, request.entityType, request.entityId)

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ApprovalRequest',
        entityId: request.id,
        action: 'APPROVE',
        after: { level: request.currentLevel, posted: true },
      },
      meta,
    )

    return { id: request.id, status: 'APPROVED' as const }
  })
}

async function revertEntityToDraft(
  tx: Tx,
  ctx: OrgContext,
  entityType: ApprovalEntityType,
  entityId: string,
) {
  if (entityType === 'SALES_DOCUMENT') {
    await tx.salesDocument.updateMany({
      where: { id: entityId, orgId: ctx.orgId, status: 'PENDING_APPROVAL' },
      data: { status: 'DRAFT' },
    })
    return
  }
  if (entityType === 'PURCHASE_DOCUMENT') {
    await tx.purchaseDocument.updateMany({
      where: { id: entityId, orgId: ctx.orgId, status: 'PENDING_APPROVAL' },
      data: { status: 'DRAFT' },
    })
  }
}

async function postApprovedEntity(
  tx: Tx,
  ctx: OrgContext,
  entityType: ApprovalEntityType,
  entityId: string,
) {
  if (entityType === 'SALES_DOCUMENT') {
    const sales = await import('@/server/services/sales.service')
    await sales.postDocument(tx, ctx, entityId)
    return
  }
  if (entityType === 'PURCHASE_DOCUMENT') {
    const purchases = await import('@/server/services/purchase.service')
    await purchases.postDocument(tx, ctx, entityId)
  }
}

export { APPROVAL_ENTITY_TYPES, entityTypeLabel } from '@/lib/approval-labels'
