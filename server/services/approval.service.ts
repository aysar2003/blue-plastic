/**
 * Document approvals — international maker-checker (SOX / COSO segregation of duties).
 *
 * Custom workflows: many named rules per document family. First enabled match by
 * priority (then higher minAmount) wins for the amount band [min, max).
 *
 * When enabled for the company:
 *  1. Maker saves a posting document → PENDING_APPROVAL + ApprovalRequest
 *  2. Checker Approve → post to ledger; Reject → DRAFT
 *  3. Owner/Admin and POS till sales post immediately (no inbox hold)
 */
import type { ApprovalEntityType, ApprovalRequestStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/client'

import { forbidden, isAppError, notFound, precondition, validation } from '@/server/errors'
import type { OrgContext } from '@/server/auth/context'
import type { Permission } from '@/server/auth/permissions'
import { db, type Tx } from '@/server/db'
import { requestMeta, writeAudit } from '@/server/audit'
import { isValidDocumentKind } from '@/lib/approval-labels'
import { approvalPack, isFamilyWideKindRule } from '@/lib/approval-templates'
import { mayBypassApprovals } from '@/lib/roles'
import { paged, paginate, type ListQuery } from '@/lib/validation/common'

const POLICY_WITH_APPROVERS = {
  approvers: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const

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

/**
 * First visit: install the standard checker pack (invoices, bills, payments…)
 * instead of a catch-all on every document family. Existing companies keep
 * whatever they already saved.
 */
export async function ensureDefaultPolicies(ctx: OrgContext, tx: DbLike = db) {
  const count = await tx.approvalPolicy.count({ where: { orgId: ctx.orgId } })
  if (count > 0) return
  await installPack(ctx, 'standard', { disableCatchAll: false, tx })
}

export async function listPolicies(ctx: OrgContext) {
  await ensureDefaultPolicies(ctx)
  return db.approvalPolicy.findMany({
    where: { orgId: ctx.orgId },
    include: POLICY_WITH_APPROVERS,
    orderBy: [{ entityType: 'asc' }, { priority: 'asc' }, { minAmount: 'desc' }],
  })
}

/** Active company users a rule can be restricted to. */
export async function listAssignableApprovers(ctx: OrgContext) {
  const rows = await db.membership.findMany({
    where: {
      orgId: ctx.orgId,
      status: 'ACTIVE',
      role: { not: 'CUSTOMER' },
    },
    select: {
      userId: true,
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { user: { name: 'asc' } },
  })
  return rows.map((row) => ({
    id: row.user.id,
    name: row.user.name,
    email: row.user.email,
    role: row.role,
  }))
}

function parseAmount(raw: string | number | null | undefined, label: string): Decimal | null {
  if (raw == null || raw === '') return null
  const value = new Decimal(raw)
  if (value.isNegative()) throw validation(`${label} cannot be negative.`)
  return value
}

function normalizeDocumentKind(
  entityType: ApprovalEntityType,
  raw: string | null | undefined,
): string | null {
  const kind = raw?.trim() || null
  if (!isValidDocumentKind(entityType, kind)) {
    throw validation('That document kind does not belong to this family.', {
      documentKind: ['Choose a kind for this family, or leave blank for all'],
    })
  }
  return kind
}

async function replaceApprovers(
  tx: DbLike,
  ctx: OrgContext,
  policyId: string,
  userIds: string[] | undefined,
) {
  if (userIds === undefined) return
  const unique = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) {
    await tx.approvalPolicyApprover.deleteMany({ where: { orgId: ctx.orgId, policyId } })
    return
  }
  const members = await tx.membership.findMany({
    where: {
      orgId: ctx.orgId,
      userId: { in: unique },
      status: 'ACTIVE',
      role: { not: 'CUSTOMER' },
    },
    select: { userId: true },
  })
  const allowed = new Set(members.map((row) => row.userId))
  const missing = unique.filter((id) => !allowed.has(id))
  if (missing.length > 0) {
    throw validation('Choose people who belong to this company.')
  }
  await tx.approvalPolicyApprover.deleteMany({ where: { orgId: ctx.orgId, policyId } })
  await tx.approvalPolicyApprover.createMany({
    data: unique.map((userId) => ({ orgId: ctx.orgId, policyId, userId })),
  })
}

export async function createPolicy(
  ctx: OrgContext,
  input: {
    name: string
    entityType: ApprovalEntityType
    documentKind?: string | null
    enabled?: boolean
    minAmount?: string | number
    maxAmount?: string | number | null
    priority?: number
    requireDifferentApprover?: boolean
    levels?: number
    approverUserIds?: string[]
    source?: string
    packKey?: string | null
  },
) {
  const name = input.name.trim()
  if (!name) throw validation('Give the workflow a name.', { name: ['Required'] })
  const documentKind = normalizeDocumentKind(input.entityType, input.documentKind)
  const minAmount = parseAmount(input.minAmount ?? 0, 'Minimum amount') ?? new Decimal(0)
  const maxAmount = parseAmount(input.maxAmount ?? null, 'Maximum amount')
  if (maxAmount && maxAmount.lessThanOrEqualTo(minAmount)) {
    throw validation('Maximum must be greater than minimum.')
  }
  const levels = Math.min(3, Math.max(1, Math.floor(input.levels ?? 1)))
  const priority = Math.max(1, Math.floor(input.priority ?? 100))
  const source = input.source === 'READY' ? 'READY' : 'CUSTOM'

  return db.$transaction(async (tx) => {
    const policy = await tx.approvalPolicy.create({
      data: {
        orgId: ctx.orgId,
        name,
        entityType: input.entityType,
        documentKind,
        enabled: input.enabled !== false,
        minAmount,
        maxAmount,
        priority,
        requireDifferentApprover: input.requireDifferentApprover !== false,
        levels,
        source,
        packKey: source === 'READY' ? (input.packKey ?? null) : null,
      },
    })
    await replaceApprovers(tx, ctx, policy.id, input.approverUserIds)
    return tx.approvalPolicy.findFirstOrThrow({
      where: { id: policy.id },
      include: POLICY_WITH_APPROVERS,
    })
  })
}

export async function updatePolicy(
  ctx: OrgContext,
  input: {
    id: string
    name: string
    documentKind?: string | null
    enabled: boolean
    minAmount: string | number
    maxAmount?: string | number | null
    priority: number
    requireDifferentApprover: boolean
    levels: number
    approverUserIds?: string[]
  },
) {
  const existing = await db.approvalPolicy.findFirst({
    where: { id: input.id, orgId: ctx.orgId },
  })
  if (!existing) throw notFound('Approval rule')

  const name = input.name.trim()
  if (!name) throw validation('Give the workflow a name.', { name: ['Required'] })
  const documentKind =
    input.documentKind === undefined
      ? existing.documentKind
      : normalizeDocumentKind(existing.entityType, input.documentKind)
  const minAmount = parseAmount(input.minAmount, 'Minimum amount') ?? new Decimal(0)
  const maxAmount = parseAmount(input.maxAmount ?? null, 'Maximum amount')
  if (maxAmount && maxAmount.lessThanOrEqualTo(minAmount)) {
    throw validation('Maximum must be greater than minimum.')
  }
  const levels = Math.min(3, Math.max(1, Math.floor(input.levels)))
  const priority = Math.max(1, Math.floor(input.priority))

  return db.$transaction(async (tx) => {
    await tx.approvalPolicy.update({
      where: { id: existing.id },
      data: {
        name,
        documentKind,
        enabled: input.enabled,
        minAmount,
        maxAmount,
        priority,
        requireDifferentApprover: input.requireDifferentApprover,
        levels,
      },
    })
    await replaceApprovers(tx, ctx, existing.id, input.approverUserIds)
    return tx.approvalPolicy.findFirstOrThrow({
      where: { id: existing.id },
      include: POLICY_WITH_APPROVERS,
    })
  })
}

export async function installPack(
  ctx: OrgContext,
  packKey: string,
  options: { disableCatchAll?: boolean; tx?: DbLike } = {},
) {
  const pack = approvalPack(packKey)
  if (!pack) throw validation('Unknown ready-made workflow.')
  const tx = options.tx ?? db
  const disableCatchAll = options.disableCatchAll !== false

  const run = async (client: DbLike) => {
    if (disableCatchAll) {
      const familyWide = await client.approvalPolicy.findMany({
        where: { orgId: ctx.orgId, documentKind: null },
        select: { id: true, entityType: true, documentKind: true },
      })
      const ids = familyWide.filter((row) => isFamilyWideKindRule(row)).map((row) => row.id)
      if (ids.length > 0) {
        await client.approvalPolicy.updateMany({
          where: { orgId: ctx.orgId, id: { in: ids } },
          data: { enabled: false },
        })
      }
    }

    for (const rule of pack.rules) {
      const minAmount = new Decimal(rule.minAmount)
      const maxAmount = rule.maxAmount == null ? null : new Decimal(rule.maxAmount)
      const existing = await client.approvalPolicy.findFirst({
        where: {
          orgId: ctx.orgId,
          entityType: rule.entityType,
          documentKind: rule.documentKind,
          minAmount,
          maxAmount,
        },
      })
      if (existing) {
        await client.approvalPolicy.update({
          where: { id: existing.id },
          data: {
            name: rule.name,
            enabled: true,
            priority: rule.priority,
            levels: rule.levels,
            requireDifferentApprover: rule.requireDifferentApprover,
            source: 'READY',
            packKey: pack.key,
          },
        })
        continue
      }
      await client.approvalPolicy.create({
        data: {
          orgId: ctx.orgId,
          name: rule.name,
          entityType: rule.entityType,
          documentKind: rule.documentKind,
          enabled: true,
          minAmount,
          maxAmount,
          priority: rule.priority,
          requireDifferentApprover: rule.requireDifferentApprover,
          levels: rule.levels,
          source: 'READY',
          packKey: pack.key,
        },
      })
    }

    await releasePendingNoLongerGated(ctx, client)
    return { packKey: pack.key, name: pack.name, rules: pack.rules.length }
  }

  if (options.tx) return run(tx)
  return db.$transaction(async (inner) => run(inner))
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
 * True when this document must wait in the inbox instead of posting / opening.
 * Picks the first matching enabled workflow (priority, then higher floor).
 *
 * `documentKind` narrows Sales/Purchases (e.g. SALES_ORDER, PURCHASE_ORDER).
 * A rule with a blank kind matches every kind in the family; a specific kind
 * only matches that subtype — so you can approve POs without holding every bill.
 */
export async function needsApproval(
  ctx: OrgContext,
  entityType: ApprovalEntityType,
  amount: Decimal | string | number,
  tx: DbLike = db,
  documentKind?: string | null,
): Promise<{ required: boolean; levels: number; requireDifferentApprover: boolean; policyId?: string }> {
  if (!approvalsEnabled(ctx)) {
    return { required: false, levels: 1, requireDifferentApprover: true }
  }
  // Owner and Admin post immediately — they are not held in the approvals inbox.
  if (mayBypassApprovals(ctx.role)) {
    return { required: false, levels: 1, requireDifferentApprover: true }
  }
  await ensureDefaultPolicies(ctx, tx)
  const value = amount instanceof Decimal ? amount : new Decimal(amount || 0)
  const kind = documentKind?.trim() || null
  const policies = await tx.approvalPolicy.findMany({
    where: { orgId: ctx.orgId, entityType, enabled: true },
    orderBy: [{ priority: 'asc' }, { minAmount: 'desc' }],
  })

  for (const policy of policies) {
    // Specific rule only fires for that kind; blank rule covers the whole family.
    if (policy.documentKind && policy.documentKind !== kind) continue
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

async function requestDocumentKind(
  client: DbLike,
  orgId: string,
  entityType: ApprovalEntityType,
  entityId: string,
): Promise<string | null> {
  if (entityType === 'SALES_DOCUMENT') {
    const row = await client.salesDocument.findFirst({
      where: { id: entityId, orgId },
      select: { type: true },
    })
    return row?.type ?? null
  }
  if (entityType === 'PURCHASE_DOCUMENT') {
    const row = await client.purchaseDocument.findFirst({
      where: { id: entityId, orgId },
      select: { type: true },
    })
    return row?.type ?? null
  }
  return null
}

/** Open/post papers still waiting under a family-wide rule that a ready-made set turned off. */
async function releasePendingNoLongerGated(ctx: OrgContext, client: DbLike) {
  const pending = await client.approvalRequest.findMany({
    where: { orgId: ctx.orgId, status: 'PENDING' },
    select: { id: true, entityType: true, entityId: true, amount: true },
  })
  const now = new Date()
  for (const request of pending) {
    const kind = await requestDocumentKind(client, ctx.orgId, request.entityType, request.entityId)
    if (
      (request.entityType === 'SALES_DOCUMENT' || request.entityType === 'PURCHASE_DOCUMENT') &&
      kind == null
    ) {
      await client.approvalRequest.update({
        where: { id: request.id },
        data: { status: 'CANCELLED', decidedAt: now },
      })
      continue
    }
    const gate = await needsApproval(ctx, request.entityType, request.amount ?? 0, client, kind)
    if (gate.required) continue
    try {
      await postApprovedEntity(client, ctx, request.entityType, request.entityId)
    } catch (error) {
      if (isAppError(error) && (error.code === 'NOT_FOUND' || error.code === 'CONFLICT')) {
        await client.approvalRequest.update({
          where: { id: request.id },
          data: { status: 'CANCELLED', decidedAt: now },
        })
        continue
      }
      throw error
    }
    await client.approvalRequest.update({
      where: { id: request.id },
      data: { status: 'APPROVED', decidedAt: now },
    })
  }
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
    documentKind?: string | null
    policyId?: string | null
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

  let policyId = input.policyId ?? null
  if (!policyId) {
    const gate = await needsApproval(
      ctx,
      input.entityType,
      amount ?? 0,
      tx,
      input.documentKind,
    )
    policyId = gate.policyId ?? null
  }

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
      policyId,
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

const REQUEST_INCLUDE = {
  submittedBy: { select: { id: true, name: true, email: true } },
  policy: { include: POLICY_WITH_APPROVERS },
  decisions: {
    orderBy: { level: 'asc' as const },
    include: { decidedBy: { select: { id: true, name: true } } },
  },
} as const

export async function listPending(ctx: OrgContext) {
  return db.approvalRequest.findMany({
    where: { orgId: ctx.orgId, status: 'PENDING' },
    orderBy: { submittedAt: 'desc' },
    include: REQUEST_INCLUDE,
  })
}

/** Latest approval on each paper, for the Created / Approved block on print, PDF, and email. */
export async function latestApprovals(orgId: string, entityIds: string[]) {
  const ids = [...new Set(entityIds.filter(Boolean))]
  const map = new Map<string, { name: string; at: Date }>()
  if (ids.length === 0) return map
  const rows = await db.approvalDecision.findMany({
    where: { orgId, decision: 'APPROVED', request: { entityId: { in: ids } } },
    orderBy: { decidedAt: 'desc' },
    select: {
      decidedAt: true,
      decidedBy: { select: { name: true } },
      request: { select: { entityId: true } },
    },
  })
  for (const row of rows) {
    const entityId = row.request.entityId
    if (!map.has(entityId)) map.set(entityId, { name: row.decidedBy.name, at: row.decidedAt })
  }
  return map
}

/** Every submit / decide cycle for one paper, newest first. */
export async function listForEntity(
  ctx: OrgContext,
  entityType: ApprovalEntityType,
  entityId: string,
) {
  return db.approvalRequest.findMany({
    where: { orgId: ctx.orgId, entityType, entityId },
    orderBy: { submittedAt: 'desc' },
    include: REQUEST_INCLUDE,
  })
}

export async function counts(ctx: OrgContext) {
  const [pending, approved] = await Promise.all([
    db.approvalRequest.count({ where: { orgId: ctx.orgId, status: 'PENDING' } }),
    db.approvalRequest.count({ where: { orgId: ctx.orgId, status: 'APPROVED' } }),
  ])
  return { pending, approved }
}

export async function listRecent(ctx: OrgContext, take = 40) {
  return db.approvalRequest.findMany({
    where: { orgId: ctx.orgId, status: { in: ['APPROVED', 'REJECTED', 'CANCELLED'] } },
    orderBy: { decidedAt: 'desc' },
    take,
    include: REQUEST_INCLUDE,
  })
}

export async function listDecided(
  ctx: OrgContext,
  query: ListQuery,
  status: ApprovalRequestStatus | 'ALL' = 'APPROVED',
) {
  const where = {
    orgId: ctx.orgId,
    status:
      status === 'ALL'
        ? { in: ['APPROVED', 'REJECTED'] as ApprovalRequestStatus[] }
        : status,
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: 'insensitive' as const } },
            { submittedBy: { name: { contains: query.q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }
  const [rows, total] = await Promise.all([
    db.approvalRequest.findMany({
      where,
      orderBy: { decidedAt: 'desc' },
      include: REQUEST_INCLUDE,
      ...paginate(query),
    }),
    db.approvalRequest.count({ where }),
  ])
  return paged(rows, total, query)
}

function canDecide(ctx: OrgContext, entityType: ApprovalEntityType): boolean {
  const perm = APPROVE_PERMISSION[entityType]
  if (!perm) return false
  return ctx.permissions.has(perm)
}

function maySelfApprove(ctx: OrgContext): boolean {
  return mayBypassApprovals(ctx.role)
}

export function decisionGate(
  ctx: OrgContext,
  request: {
    entityType: ApprovalEntityType
    submittedById: string
    policy: {
      requireDifferentApprover: boolean
      approvers: { userId: string }[]
    } | null
  },
  decision: 'APPROVED' | 'REJECTED' = 'APPROVED',
): { ok: boolean; reason: string | null } {
  if (!canDecide(ctx, request.entityType)) {
    return { ok: false, reason: 'You are not allowed to approve this type of document.' }
  }
  const assigned = request.policy?.approvers ?? []
  if (assigned.length > 0 && !assigned.some((row) => row.userId === ctx.userId) && !maySelfApprove(ctx)) {
    return { ok: false, reason: 'This workflow is assigned to other users.' }
  }
  const requireDifferent = request.policy?.requireDifferentApprover ?? true
  if (
    decision === 'APPROVED' &&
    requireDifferent &&
    request.submittedById === ctx.userId &&
    !maySelfApprove(ctx)
  ) {
    return {
      ok: false,
      reason: 'You submitted this — another person must approve.',
    }
  }
  return { ok: true, reason: null }
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
      include: { policy: { include: { approvers: true } } },
    })
    if (!request) throw notFound('Approval request')
    if (request.status !== 'PENDING') {
      throw precondition('This request has already been decided.')
    }

    let policy = request.policy
    if (!policy) {
      const policies = await tx.approvalPolicy.findMany({
        where: { orgId: ctx.orgId, entityType: request.entityType, enabled: true },
        include: { approvers: true },
        orderBy: [{ priority: 'asc' }, { minAmount: 'desc' }],
      })
      const amount = request.amount ?? new Decimal(0)
      policy = policies.find((row) => amountInBand(amount, row.minAmount, row.maxAmount)) ?? null
    }

    const gate = decisionGate(ctx, { ...request, policy }, input.decision)
    if (!gate.ok) {
      throw forbidden(gate.reason ?? 'You are not allowed to decide this request.')
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
  tx: DbLike,
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
    return
  }
  if (entityType === 'CUSTOMER_PAYMENT') {
    await tx.customerPayment.updateMany({
      where: { id: entityId, orgId: ctx.orgId, status: 'PENDING_APPROVAL' },
      data: { status: 'DRAFT' },
    })
    return
  }
  if (entityType === 'BILL_PAYMENT') {
    await tx.billPayment.updateMany({
      where: { id: entityId, orgId: ctx.orgId, status: 'PENDING_APPROVAL' },
      data: { status: 'DRAFT' },
    })
    return
  }
  if (entityType === 'BANK_TRANSFER') {
    await tx.bankTransfer.updateMany({
      where: { id: entityId, orgId: ctx.orgId, status: 'PENDING_APPROVAL' },
      data: { status: 'DRAFT' },
    })
    return
  }
  if (entityType === 'DEPOSIT') {
    await tx.deposit.updateMany({
      where: { id: entityId, orgId: ctx.orgId, status: 'PENDING_APPROVAL' },
      data: { status: 'DRAFT' },
    })
    return
  }
  if (entityType === 'INVENTORY_ADJUSTMENT') {
    await tx.inventoryAdjustment.updateMany({
      where: { id: entityId, orgId: ctx.orgId, status: 'PENDING_APPROVAL' },
      data: { status: 'DRAFT' },
    })
    return
  }
  if (entityType === 'JOURNAL') {
    // Draft journals may be deleted outright — they never hit balances.
    await tx.journal.deleteMany({
      where: { id: entityId, orgId: ctx.orgId, status: 'DRAFT', sourceType: 'MANUAL' },
    })
    return
  }
  if (entityType === 'CUSTOMER' || entityType === 'VENDOR') {
    await tx.journal.deleteMany({
      where: {
        orgId: ctx.orgId,
        sourceType: 'OPENING_BALANCE',
        sourceId: entityId,
        status: 'DRAFT',
      },
    })
  }
}

async function postApprovedEntity(
  tx: DbLike,
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
    return
  }
  if (entityType === 'CUSTOMER_PAYMENT') {
    const payments = await import('@/server/services/payment.service')
    await payments.postPayment(tx, ctx, entityId)
    return
  }
  if (entityType === 'BILL_PAYMENT') {
    const billPayments = await import('@/server/services/bill-payment.service')
    await billPayments.postBillPayment(tx, ctx, entityId)
    return
  }
  if (entityType === 'BANK_TRANSFER') {
    const banking = await import('@/server/services/banking.service')
    await banking.postTransfer(tx, ctx, entityId)
    return
  }
  if (entityType === 'DEPOSIT') {
    const banking = await import('@/server/services/banking.service')
    await banking.postDeposit(tx, ctx, entityId)
    return
  }
  if (entityType === 'INVENTORY_ADJUSTMENT') {
    const inventory = await import('@/server/services/inventory.service')
    await inventory.postAdjustment(tx, ctx, entityId)
    return
  }
  if (entityType === 'JOURNAL') {
    const journals = await import('@/server/services/journal.service')
    await journals.promoteApprovedManual(tx, ctx, entityId)
    return
  }
  if (entityType === 'CUSTOMER') {
    const contacts = await import('@/server/services/contact.service')
    await contacts.postOpeningBalanceApproval(tx, ctx, 'customer', entityId)
    return
  }
  if (entityType === 'VENDOR') {
    const contacts = await import('@/server/services/contact.service')
    await contacts.postOpeningBalanceApproval(tx, ctx, 'vendor', entityId)
  }
}

export { APPROVAL_ENTITY_TYPES, entityTypeLabel } from '@/lib/approval-labels'
