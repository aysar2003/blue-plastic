import 'server-only'

import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/client'

import { companyLimitStatus } from '@/lib/company-limits'
import {
  MODULE_FLAGS,
  MODULE_FORM_KEYS,
  modulesFromFormValues,
  parseFeatureFlags,
  parseModulesSelection,
  type ModuleFlag,
} from '@/lib/feature-flags'
import type {
  ReviewRentPaymentInput,
  SubmitRentPaymentInput,
  UpdateBillingSettingsInput,
  UpsertPlatformPlanInput,
} from '@/lib/validation/platform-billing'
import { extendRentExpiry } from '@/lib/validation/platform-billing'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, forbidden, notFound, validation } from '@/server/errors'
import {
  readRentPaymentBytes,
  removeRentPaymentStored,
  storeRentPaymentReceipt,
} from '@/server/files/rent-payments'

function requireSystemOwner(ctx: OrgContext) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can manage platform billing.')
  }
}

function requireCompanyBillingManager(ctx: OrgContext) {
  if (ctx.role !== 'OWNER' && ctx.role !== 'ADMIN' && !ctx.isSystemOwner) {
    throw forbidden('Only a company owner or admin can manage rent payments.')
  }
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function planModulesFromInput(input: UpsertPlatformPlanInput): Record<ModuleFlag, boolean> | null {
  const data = input as Record<string, unknown>
  const touched = MODULE_FLAGS.some((key) => data[MODULE_FORM_KEYS[key]] !== undefined)
  if (!touched) return null
  return modulesFromFormValues(data)
}

export async function listActivePlans() {
  const rows = await db.platformPlan.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return rows.map(serializePlan)
}

export async function listAllPlans(ctx: OrgContext) {
  requireSystemOwner(ctx)
  const rows = await db.platformPlan.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return rows.map(serializePlan)
}

function serializePlan(row: {
  id: string
  name: string
  months: number
  price: Decimal
  currency: string
  maxUsers: number | null
  modules: Prisma.JsonValue
  active: boolean
  sortOrder: number
}) {
  return {
    id: row.id,
    name: row.name,
    months: row.months,
    price: row.price.toString(),
    currency: row.currency,
    maxUsers: row.maxUsers,
    modules: row.modules == null ? null : parseModulesSelection(row.modules),
    active: row.active,
    sortOrder: row.sortOrder,
  }
}

export async function upsertPlan(ctx: OrgContext, input: UpsertPlatformPlanInput) {
  requireSystemOwner(ctx)
  const modules = planModulesFromInput(input)
  const data = {
    name: input.name.trim(),
    months: input.months,
    price: new Decimal(input.price),
    currency: input.currency,
    maxUsers: input.maxUsers,
    modules: modules as unknown as Prisma.InputJsonValue | undefined,
    active: input.active,
    sortOrder: input.sortOrder,
  }

  if (input.id) {
    const existing = await db.platformPlan.findUnique({ where: { id: input.id }, select: { id: true } })
    if (!existing) throw notFound('Plan')
    const row = await db.platformPlan.update({
      where: { id: input.id },
      data: {
        ...data,
        modules: modules === null ? Prisma.JsonNull : (modules as unknown as Prisma.InputJsonValue),
      },
    })
    return serializePlan(row)
  }

  const row = await db.platformPlan.create({
    data: {
      ...data,
      modules: modules === null ? undefined : (modules as unknown as Prisma.InputJsonValue),
    },
  })
  return serializePlan(row)
}

export async function setPlanActive(
  ctx: OrgContext,
  input: { id: string; active: boolean },
) {
  requireSystemOwner(ctx)
  const row = await db.platformPlan.update({
    where: { id: input.id },
    data: { active: input.active },
  })
  return serializePlan(row)
}

export async function getBillingSettings() {
  const row = await db.platformBillingSettings.findUnique({ where: { id: 'default' } })
  if (!row) {
    return {
      id: 'default' as const,
      evcNumber: null,
      zaadNumber: null,
      edahabNumber: null,
      bankName: null,
      bankAccountName: null,
      bankAccountNumber: null,
      instructions:
        'Pay the plan amount via EVC, Zaad, eDahab, or bank transfer, then submit your transaction reference. The system owner will confirm and extend your rent.',
    }
  }
  return {
    id: row.id,
    evcNumber: row.evcNumber,
    zaadNumber: row.zaadNumber,
    edahabNumber: row.edahabNumber,
    bankName: row.bankName,
    bankAccountName: row.bankAccountName,
    bankAccountNumber: row.bankAccountNumber,
    instructions: row.instructions,
  }
}

export async function updateBillingSettings(ctx: OrgContext, input: UpdateBillingSettingsInput) {
  requireSystemOwner(ctx)
  const row = await db.platformBillingSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      evcNumber: emptyToNull(input.evcNumber),
      zaadNumber: emptyToNull(input.zaadNumber),
      edahabNumber: emptyToNull(input.edahabNumber),
      bankName: emptyToNull(input.bankName),
      bankAccountName: emptyToNull(input.bankAccountName),
      bankAccountNumber: emptyToNull(input.bankAccountNumber),
      instructions: emptyToNull(input.instructions),
    },
    update: {
      evcNumber: emptyToNull(input.evcNumber),
      zaadNumber: emptyToNull(input.zaadNumber),
      edahabNumber: emptyToNull(input.edahabNumber),
      bankName: emptyToNull(input.bankName),
      bankAccountName: emptyToNull(input.bankAccountName),
      bankAccountNumber: emptyToNull(input.bankAccountNumber),
      instructions: emptyToNull(input.instructions),
    },
  })
  return {
    id: row.id,
    evcNumber: row.evcNumber,
    zaadNumber: row.zaadNumber,
    edahabNumber: row.edahabNumber,
    bankName: row.bankName,
    bankAccountName: row.bankAccountName,
    bankAccountNumber: row.bankAccountNumber,
    instructions: row.instructions,
  }
}

export async function companyBillingOverview(ctx: OrgContext) {
  // Any staff member of the company may view rent status; submit stays OWNER/ADMIN.
  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: {
      id: true,
      name: true,
      accessRestricted: true,
      rentExpiresAt: true,
      maxUsers: true,
      rentNote: true,
      featureFlags: true,
    },
  })
  if (!org) throw notFound('Company')

  const [plans, settings, payments] = await Promise.all([
    listActivePlans(),
    getBillingSettings(),
    db.companyRentPayment.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  const limits = companyLimitStatus(org)
  return {
    company: {
      id: org.id,
      name: org.name,
      ...limits,
      maxUsers: org.maxUsers,
    },
    plans,
    settings,
    payments: payments.map(serializePayment),
  }
}

function serializePayment(row: {
  id: string
  orgId: string
  planId: string
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
  method: 'EVC' | 'ZAAD' | 'EDAHAB' | 'BANK'
  amount: Decimal
  currency: string
  reference: string
  notes: string | null
  reviewNote: string | null
  planName: string
  planMonths: number
  planMaxUsers: number | null
  storageKey: string | null
  createdAt: Date
  reviewedAt: Date | null
}) {
  return {
    id: row.id,
    orgId: row.orgId,
    planId: row.planId,
    status: row.status,
    method: row.method,
    amount: row.amount.toString(),
    currency: row.currency,
    reference: row.reference,
    notes: row.notes,
    reviewNote: row.reviewNote,
    planName: row.planName,
    planMonths: row.planMonths,
    planMaxUsers: row.planMaxUsers,
    hasReceipt: Boolean(row.storageKey),
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  }
}

export async function submitRentPayment(
  ctx: OrgContext,
  input: SubmitRentPaymentInput,
  file?: File | null,
) {
  requireCompanyBillingManager(ctx)

  const pending = await db.companyRentPayment.findFirst({
    where: { orgId: ctx.orgId, status: 'PENDING' },
    select: { id: true },
  })
  if (pending) {
    throw conflict('You already have a rent payment waiting for review.')
  }

  const plan = await db.platformPlan.findFirst({
    where: { id: input.planId, active: true },
  })
  if (!plan) throw notFound('Plan')

  const modules =
    plan.modules == null ? null : parseModulesSelection(plan.modules)

  const row = await db.companyRentPayment.create({
    data: {
      orgId: ctx.orgId,
      planId: plan.id,
      status: 'PENDING',
      method: input.method,
      amount: new Decimal(input.amount),
      currency: plan.currency,
      reference: input.reference.trim(),
      notes: input.notes,
      submittedById: ctx.userId,
      planName: plan.name,
      planMonths: plan.months,
      planMaxUsers: plan.maxUsers,
      planModules: modules as unknown as Prisma.InputJsonValue | undefined,
    },
  })

  if (file && file.size > 0) {
    const stored = await storeRentPaymentReceipt(ctx.orgId, row.id, file)
    await db.companyRentPayment.update({
      where: { id: row.id },
      data: stored,
    })
  }

  return { id: row.id }
}

export type PendingRentPaymentRow = ReturnType<typeof serializePayment> & {
  companyName: string
  submittedByEmail: string | null
  submittedByName: string | null
}

export async function listPendingRentPayments(ctx: OrgContext): Promise<PendingRentPaymentRow[]> {
  requireSystemOwner(ctx)
  const rows = await db.companyRentPayment.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: {
      organization: { select: { name: true } },
    },
  })

  const userIds = [...new Set(rows.map((r) => r.submittedById))]
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, name: true },
      })
    : []
  const byId = new Map(users.map((u) => [u.id, u]))

  return rows.map((row) => {
    const user = byId.get(row.submittedById)
    return {
      ...serializePayment(row),
      companyName: row.organization.name,
      submittedByEmail: user?.email ?? null,
      submittedByName: user?.name ?? null,
    }
  })
}

export async function reviewRentPayment(ctx: OrgContext, input: ReviewRentPaymentInput) {
  requireSystemOwner(ctx)

  const payment = await db.companyRentPayment.findUnique({
    where: { id: input.id },
  })
  if (!payment) throw notFound('Rent payment')
  if (payment.status !== 'PENDING') {
    throw conflict('This payment was already reviewed.')
  }

  if (input.decision === 'reject') {
    await db.companyRentPayment.update({
      where: { id: payment.id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: ctx.userId,
        reviewNote: input.note,
      },
    })
    return { decision: 'reject' as const, id: payment.id }
  }

  const org = await db.organization.findUnique({
    where: { id: payment.orgId },
    select: {
      id: true,
      name: true,
      rentExpiresAt: true,
      maxUsers: true,
      featureFlags: true,
    },
  })
  if (!org) throw notFound('Company')

  const newExpiry = extendRentExpiry(org.rentExpiresAt, payment.planMonths)
  const planModules =
    payment.planModules == null ? null : parseModulesSelection(payment.planModules)

  const current = parseFeatureFlags(org.featureFlags)
  const nextFlags = planModules
    ? {
        ...current,
        grantedModules: {
          ...current.grantedModules,
          ...planModules,
        },
        modules: {
          ...current.modules,
          ...planModules,
        },
      }
    : current

  await db.$transaction(async (tx) => {
    await tx.companyRentPayment.update({
      where: { id: payment.id },
      data: {
        status: 'CONFIRMED',
        reviewedAt: new Date(),
        reviewedBy: ctx.userId,
        reviewNote: input.note,
      },
    })

    await tx.organization.update({
      where: { id: org.id },
      data: {
        rentExpiresAt: newExpiry,
        rentNote: payment.planName,
        maxUsers: payment.planMaxUsers ?? org.maxUsers,
        featureFlags: nextFlags as unknown as Prisma.InputJsonValue,
        accessRestricted: false,
      },
    })

    await tx.auditLog.create({
      data: {
        orgId: org.id,
        actorId: ctx.userId,
        entity: 'Organization',
        entityId: org.id,
        action: 'UPDATE',
        after: {
          rentPaymentId: payment.id,
          rentExpiresAt: newExpiry.toISOString(),
          rentNote: payment.planName,
          maxUsers: payment.planMaxUsers ?? org.maxUsers,
          planName: payment.planName,
        },
      },
    })
  })

  return {
    decision: 'confirm' as const,
    id: payment.id,
    orgId: org.id,
    rentExpiresAt: newExpiry.toISOString(),
  }
}

export async function downloadRentReceipt(
  ctx: OrgContext,
  input: { paymentId: string },
) {
  const payment = await db.companyRentPayment.findUnique({
    where: { id: input.paymentId },
  })
  if (!payment) throw notFound('Rent payment')

  const ownCompany = payment.orgId === ctx.orgId && (ctx.role === 'OWNER' || ctx.role === 'ADMIN')
  if (!ctx.isSystemOwner && !ownCompany) {
    throw forbidden('You cannot download this receipt.')
  }
  if (!payment.storageKey || !payment.contentType || !payment.originalName) {
    throw notFound('File')
  }
  const bytes = await readRentPaymentBytes(payment.storageKey)
  return {
    bytes,
    contentType: payment.contentType,
    originalName: payment.originalName,
  }
}

/** Remove a rejected payment's file when cleaning up (optional). */
export async function discardRejectedReceipt(ctx: OrgContext, paymentId: string) {
  requireSystemOwner(ctx)
  const payment = await db.companyRentPayment.findUnique({ where: { id: paymentId } })
  if (!payment) throw notFound('Rent payment')
  if (payment.status !== 'REJECTED') {
    throw validation('Only rejected payments can discard a receipt.')
  }
  await removeRentPaymentStored(payment.storageKey)
  await db.companyRentPayment.update({
    where: { id: payment.id },
    data: {
      storageKey: null,
      contentType: null,
      originalName: null,
      byteSize: null,
    },
  })
  return { id: payment.id }
}
