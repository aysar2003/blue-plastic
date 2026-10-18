import 'server-only'
import type { Prisma } from '@prisma/client'

import { env } from '@/lib/env'
import { parseFeatureFlags } from '@/lib/feature-flags'
import { isCollectionOverdue } from '@/lib/invoice-overdue'
import { Decimal, formatMoney, toMoneyString, ZERO } from '@/lib/money'
import { toCalendarDate, today, type CalendarDate } from '@/lib/date'
import { describeCustomerBalance } from '@/lib/portal-balance'
import { openPortalInvite, sealPortalInvite } from '@/lib/portal-invite-token'
import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type {
  AcceptPortalInviteInput,
  InvitePortalUserInput,
  ResetPortalPasswordInput,
} from '@/lib/validation/portal'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext, PortalContext } from '@/server/auth/context'
import { hashPassword } from '@/server/auth/password'
import { db } from '@/server/db'
import { conflict, forbidden, notFound, precondition, validation } from '@/server/errors'
import { subledgerBalances } from '@/server/services/contact.service'
import * as receivables from '@/server/services/receivables.service'
import * as salesService from '@/server/services/sales.service'

/** Company must turn the portal on in Settings → Apps & features. */
export function assertPortalFeatureEnabled(ctx: OrgContext) {
  if (!ctx.features.enableCustomerPortal) {
    throw forbidden(
      'The customer portal is off for this company. Turn it on under Settings → Apps & features.',
    )
  }
}

export function inviteUrlForToken(token: string, origin?: string | null): string {
  const base = (origin || env.APP_URL || '').replace(/\/$/, '')
  const path = `/portal/accept?token=${encodeURIComponent(token)}`
  return base ? `${base}${path}` : path
}

function sealInvite(membershipId: string, orgId: string) {
  return sealPortalInvite({ membershipId, orgId, secret: env.AUTH_SECRET })
}

const PORTAL_USER_SELECT = {
  id: true,
  customerId: true,
  createdAt: true,
  customer: { select: { id: true, displayName: true, companyName: true } },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      lastLoginAt: true,
      memberships: {
        where: {},
        select: {
          id: true,
          orgId: true,
          role: true,
          status: true,
          version: true,
          invitedAt: true,
          acceptedAt: true,
        },
      },
    },
  },
} satisfies Prisma.CustomerPortalUserSelect

function membershipFor(orgId: string, row: Prisma.CustomerPortalUserGetPayload<{ select: typeof PORTAL_USER_SELECT }>) {
  return row.user.memberships.find((membership) => membership.orgId === orgId) ?? null
}

function presentPortalUser(
  orgId: string,
  row: Prisma.CustomerPortalUserGetPayload<{ select: typeof PORTAL_USER_SELECT }>,
) {
  const membership = membershipFor(orgId, row)
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customer.displayName,
    customerCompany: row.customer.companyName,
    userId: row.user.id,
    name: row.user.name,
    email: row.user.email,
    lastLoginAt: row.user.lastLoginAt,
    membershipId: membership?.id ?? null,
    status: membership?.status ?? 'SUSPENDED',
    invitedAt: membership?.invitedAt ?? null,
    acceptedAt: membership?.acceptedAt ?? null,
    createdAt: row.createdAt,
  }
}

/** Staff: every portal login for this organisation. */
export async function listPortalUsers(ctx: OrgContext, query: ListQuery, customerId?: string) {
  assertPortalFeatureEnabled(ctx)
  const where: Prisma.CustomerPortalUserWhereInput = {
    orgId: ctx.orgId,
    ...(customerId ? { customerId } : {}),
    ...(query.q
      ? {
          OR: [
            { user: { name: { contains: query.q, mode: 'insensitive' } } },
            { user: { email: { contains: query.q, mode: 'insensitive' } } },
            { customer: { displayName: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.customerPortalUser.findMany({
      where,
      select: {
        ...PORTAL_USER_SELECT,
        user: {
          select: {
            ...PORTAL_USER_SELECT.user.select,
            memberships: {
              where: { orgId: ctx.orgId, role: 'CUSTOMER' },
              select: PORTAL_USER_SELECT.user.select.memberships.select,
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      ...paginate(query),
    }),
    db.customerPortalUser.count({ where }),
  ])

  return paged(
    rows.map((row) => presentPortalUser(ctx.orgId, row)),
    total,
    query,
  )
}

export type InvitePortalUserResult = {
  id: string
  membershipId: string
  userId: string
  customerId: string
  orgId: string
  email: string
  inviteMode: 'password' | 'link'
  /** Present for link mode — seal a fresh accept URL. */
  inviteToken?: string
  resent: boolean
}

/**
 * Staff: create a portal login.
 * - password → ACTIVE + temp password; customer uses `/login/portal?company=…`
 * - link → INVITED; customer opens `/portal/accept?token=…` and chooses a password
 */
export async function invitePortalUser(
  ctx: OrgContext,
  input: InvitePortalUserInput,
): Promise<InvitePortalUserResult> {
  assertPortalFeatureEnabled(ctx)
  const meta = await requestMeta()
  const mode = input.inviteMode
  const passwordHash =
    mode === 'password' ? await hashPassword(input.temporaryPassword) : null

  const customer = await db.customer.findFirst({
    where: { id: input.customerId, orgId: ctx.orgId },
    select: { id: true, displayName: true },
  })
  if (!customer) throw notFound('Customer')

  return db.$transaction(async (tx) => {
    const orgLimits = await tx.organization.findUnique({
      where: { id: ctx.orgId },
      select: { maxUsers: true },
    })
    if (orgLimits?.maxUsers != null && orgLimits.maxUsers > 0) {
      const activeUsers = await tx.membership.count({
        where: { orgId: ctx.orgId, status: { in: ['ACTIVE', 'INVITED'] } },
      })
      if (activeUsers >= orgLimits.maxUsers) {
        throw precondition(
          `This company is limited to ${orgLimits.maxUsers} users. Remove someone or ask the system owner to raise the limit.`,
        )
      }
    }

    const existingUser = await tx.user.findUnique({
      where: { email: input.email },
      select: { id: true, homeOrgId: true, passwordHash: true },
    })

    if (existingUser) {
      const existingMembership = await tx.membership.findUnique({
        where: { orgId_userId: { orgId: ctx.orgId, userId: existingUser.id } },
        select: { id: true, role: true, status: true },
      })
      if (existingMembership) {
        if (existingMembership.role === 'CUSTOMER' && existingMembership.status === 'INVITED') {
          const link = await tx.customerPortalUser.findFirst({
            where: { orgId: ctx.orgId, userId: existingUser.id },
            select: { id: true, customerId: true },
          })

          if (mode === 'password') {
            await tx.user.update({
              where: { id: existingUser.id },
              data: { name: input.name, passwordHash: passwordHash! },
            })
            await tx.membership.update({
              where: { id: existingMembership.id },
              data: {
                status: 'ACTIVE',
                acceptedAt: new Date(),
                version: { increment: 1 },
              },
            })
            return {
              id: link?.id ?? existingMembership.id,
              membershipId: existingMembership.id,
              userId: existingUser.id,
              customerId: link?.customerId ?? customer.id,
              orgId: ctx.orgId,
              email: input.email,
              inviteMode: 'password' as const,
              resent: true,
            }
          }

          await tx.user.update({
            where: { id: existingUser.id },
            data: { name: input.name },
          })
          return {
            id: link?.id ?? existingMembership.id,
            membershipId: existingMembership.id,
            userId: existingUser.id,
            customerId: link?.customerId ?? customer.id,
            orgId: ctx.orgId,
            email: input.email,
            inviteMode: 'link' as const,
            inviteToken: sealInvite(existingMembership.id, ctx.orgId),
            resent: true,
          }
        }
        throw conflict(
          existingMembership.role === 'CUSTOMER'
            ? 'That email already has a portal login for this company.'
            : 'That email already belongs to a staff member of this company.',
        )
      }
    }

    const status = mode === 'password' ? 'ACTIVE' : 'INVITED'
    const acceptedAt = mode === 'password' ? new Date() : null

    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          ...(passwordHash ? { passwordHash } : {}),
          homeOrgId: ctx.orgId,
        },
        select: { id: true, homeOrgId: true, passwordHash: true },
      }))

    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          name: input.name,
          ...(passwordHash
            ? { passwordHash }
            : !existingUser.passwordHash
              ? { passwordHash: null }
              : {}),
          ...(!existingUser.homeOrgId ? { homeOrgId: ctx.orgId } : {}),
        },
      })
    }

    const membership = await tx.membership.create({
      data: {
        orgId: ctx.orgId,
        userId: user.id,
        role: 'CUSTOMER',
        permissionsOverride: [],
        status,
        invitedById: ctx.userId,
        invitedAt: new Date(),
        acceptedAt,
      },
      select: { id: true },
    })

    const link = await tx.customerPortalUser.create({
      data: {
        orgId: ctx.orgId,
        userId: user.id,
        customerId: customer.id,
      },
      select: { id: true, customerId: true, userId: true },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'CustomerPortalUser',
        entityId: link.id,
        action: 'CREATE',
        after: {
          email: input.email,
          customerId: customer.id,
          customerName: customer.displayName,
          membershipId: membership.id,
          status,
          inviteMode: mode,
        },
      },
      meta,
    )

    return {
      id: link.id,
      membershipId: membership.id,
      userId: user.id,
      customerId: customer.id,
      orgId: ctx.orgId,
      email: input.email,
      inviteMode: mode,
      ...(mode === 'link' ? { inviteToken: sealInvite(membership.id, ctx.orgId) } : {}),
      resent: false,
    }
  })
}

/** Fresh invite link for an INVITED portal membership (copy again). */
export async function refreshPortalInviteLink(ctx: OrgContext, membershipId: string) {
  assertPortalFeatureEnabled(ctx)
  const membership = await db.membership.findFirst({
    where: { id: membershipId, orgId: ctx.orgId, role: 'CUSTOMER' },
    select: { id: true, status: true },
  })
  if (!membership) throw notFound('Portal user')
  if (membership.status !== 'INVITED') {
    throw precondition('Only pending invites can get a new link. Use reset password for active logins.')
  }
  const token = sealInvite(membership.id, ctx.orgId)
  return { membershipId: membership.id, inviteToken: token, inviteUrl: inviteUrlForToken(token) }
}

/** Public: customer opens the invite link and chooses their password. */
export async function acceptPortalInvite(input: AcceptPortalInviteInput) {
  const opened = openPortalInvite(input.token, env.AUTH_SECRET)
  if (!opened) throw validation('This invite link is invalid or has expired.')

  const membership = await db.membership.findFirst({
    where: {
      id: opened.membershipId,
      orgId: opened.orgId,
      role: 'CUSTOMER',
      status: 'INVITED',
    },
    select: {
      id: true,
      userId: true,
      orgId: true,
      organization: { select: { featureFlags: true, name: true } },
      user: { select: { id: true, email: true, name: true } },
    },
  })
  if (!membership) throw validation('This invite is no longer available.')

  const flags = parseFeatureFlags(membership.organization.featureFlags)
  if (!flags.enableCustomerPortal) {
    throw forbidden('The customer portal is not available for this company.')
  }

  const passwordHash = await hashPassword(input.password)

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: membership.userId },
      data: { name: input.name, passwordHash },
    })
    await tx.membership.update({
      where: { id: membership.id },
      data: {
        status: 'ACTIVE',
        acceptedAt: new Date(),
        version: { increment: 1 },
      },
    })
  })

  return {
    email: membership.user.email,
    organizationName: membership.organization.name,
    orgId: membership.orgId,
  }
}

const PORTAL_ORG_PUBLIC_SELECT = {
  id: true,
  name: true,
  legalName: true,
  brandMark: true,
  logoStorageKey: true,
  updatedAt: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  region: true,
  postalCode: true,
  country: true,
  phone: true,
  email: true,
  featureFlags: true,
} as const

function presentPortalOrgPublic(org: {
  id: string
  name: string
  legalName: string | null
  brandMark: string | null
  logoStorageKey: string | null
  updatedAt: Date
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  country: string | null
  phone: string | null
  email: string | null
  featureFlags: unknown
}) {
  if (!parseFeatureFlags(org.featureFlags).enableCustomerPortal) return null
  return {
    orgId: org.id,
    organizationName: org.name,
    legalName: org.legalName,
    brandMark: org.brandMark,
    hasLogo: Boolean(org.logoStorageKey),
    logoVersion: org.updatedAt,
    addressLine1: org.addressLine1,
    addressLine2: org.addressLine2,
    city: org.city,
    region: org.region,
    postalCode: org.postalCode,
    country: org.country,
    phone: org.phone,
    email: org.email,
  }
}

/**
 * Public: resolve company branding from a portal login email.
 * Returns null when unknown / ambiguous — never reveals whether the email exists.
 */
export async function findPortalCompanyForEmail(email: string) {
  const normalised = email.trim().toLowerCase()
  if (!normalised.includes('@')) return null

  const memberships = await db.membership.findMany({
    where: {
      role: 'CUSTOMER',
      status: { in: ['ACTIVE', 'INVITED'] },
      user: { email: normalised },
    },
    select: {
      organization: { select: PORTAL_ORG_PUBLIC_SELECT },
    },
    take: 2,
  })

  if (memberships.length !== 1) return null
  return presentPortalOrgPublic(memberships[0]!.organization)
}

/** Peek invite details for the accept page (no mutation). */
export async function peekPortalInvite(token: string) {
  const opened = openPortalInvite(token, env.AUTH_SECRET)
  if (!opened) return null
  const membership = await db.membership.findFirst({
    where: {
      id: opened.membershipId,
      orgId: opened.orgId,
      role: 'CUSTOMER',
      status: 'INVITED',
    },
    select: {
      orgId: true,
      user: { select: { email: true, name: true } },
      organization: { select: PORTAL_ORG_PUBLIC_SELECT },
    },
  })
  if (!membership) return null
  const presented = presentPortalOrgPublic(membership.organization)
  if (!presented) return null
  return {
    ...presented,
    email: membership.user.email,
    name: membership.user.name,
    companyEmail: presented.email,
  }
}

export async function setPortalUserStatus(
  ctx: OrgContext,
  membershipId: string,
  status: 'ACTIVE' | 'SUSPENDED',
) {
  assertPortalFeatureEnabled(ctx)
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { id: membershipId, orgId: ctx.orgId, role: 'CUSTOMER' },
      select: {
        id: true,
        status: true,
        userId: true,
        user: { select: { email: true } },
      },
    })
    if (!membership) throw notFound('Portal user')

    const after = await tx.membership.update({
      where: { id: membershipId },
      data: { status, version: { increment: 1 } },
      select: { id: true, status: true },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Membership',
        entityId: membershipId,
        action: status === 'ACTIVE' ? 'RESTORE' : 'ARCHIVE',
        before: { status: membership.status, email: membership.user.email },
        after: { status: after.status },
      },
      meta,
    )

    return after
  })
}

export async function resetPortalPassword(ctx: OrgContext, input: ResetPortalPasswordInput) {
  assertPortalFeatureEnabled(ctx)
  const meta = await requestMeta()
  const passwordHash = await hashPassword(input.temporaryPassword)

  return db.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { id: input.membershipId, orgId: ctx.orgId, role: 'CUSTOMER' },
      select: { id: true, userId: true, user: { select: { email: true } } },
    })
    if (!membership) throw notFound('Portal user')

    await tx.user.update({
      where: { id: membership.userId },
      data: { passwordHash },
    })
    await tx.membership.update({
      where: { id: membership.id },
      data: { version: { increment: 1 } },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Membership',
        entityId: membership.id,
        action: 'UPDATE',
        after: { passwordReset: true, email: membership.user.email },
      },
      meta,
    )

    return { id: membership.id }
  })
}

export async function removePortalUser(ctx: OrgContext, membershipId: string) {
  assertPortalFeatureEnabled(ctx)
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { id: membershipId, orgId: ctx.orgId, role: 'CUSTOMER' },
      select: {
        id: true,
        userId: true,
        user: { select: { email: true } },
      },
    })
    if (!membership) throw notFound('Portal user')

    await tx.customerPortalUser.deleteMany({
      where: { orgId: ctx.orgId, userId: membership.userId },
    })
    await tx.membership.delete({ where: { id: membership.id } })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Membership',
        entityId: membership.id,
        action: 'DELETE',
        before: { email: membership.user.email, role: 'CUSTOMER' },
      },
      meta,
    )

    return { id: membershipId }
  })
}

function assertOwnCustomer(ctx: PortalContext, customerId: string) {
  if (customerId !== ctx.portalCustomerId) {
    throw forbidden('You can only view your own account.')
  }
}

/** Portal home: profile, ledger balance, overdue and open invoice totals. */
export async function dashboard(ctx: PortalContext) {
  assertPortalFeatureEnabled(ctx)
  const customerId = ctx.portalCustomerId
  const asOf = today(ctx.organization.timeZone)

  const [customer, balances, invoices] = await Promise.all([
    db.customer.findFirst({
      where: { id: customerId, orgId: ctx.orgId },
      select: {
        id: true,
        displayName: true,
        companyName: true,
        email: true,
        phone: true,
        mobile: true,
      },
    }),
    subledgerBalances(db, ctx, 'customer', [customerId]),
    db.$queryRaw<
      {
        id: string
        number: string
        total: string
        applied: string
        dueDate: Date | null
        promisedDate: Date | null
        excludeFromOverdue: boolean
        status: string
      }[]
    >`
      SELECT d.id,
             d.number,
             d.total::text AS total,
             COALESCE((
               SELECT SUM(a.amount) FROM sales_applications a WHERE a."invoiceId" = d.id
             ), 0)::text AS applied,
             d."dueDate" AS "dueDate",
             d."promisedDate" AS "promisedDate",
             d."excludeFromOverdue" AS "excludeFromOverdue",
             d.status::text AS status
        FROM sales_documents d
       WHERE d."orgId" = ${ctx.orgId}
         AND d."customerId" = ${customerId}
         AND d."deletedAt" IS NULL
         AND d.type = 'INVOICE'
         AND d.status::text IN ('OPEN', 'PARTIAL')
    `,
  ])

  if (!customer) throw notFound('Customer')

  const balance = balances.get(customerId) ?? ZERO
  let overdue = ZERO
  let open = ZERO
  let overdueCount = 0
  let openCount = 0

  for (const invoice of invoices) {
    const remaining = Decimal.max(new Decimal(invoice.total).minus(invoice.applied), ZERO)
    if (remaining.isZero()) continue
    const overdueFlag = isCollectionOverdue(
      {
        status: invoice.status,
        dueDate: invoice.dueDate ? toCalendarDate(invoice.dueDate) : null,
        promisedDate: invoice.promisedDate ? toCalendarDate(invoice.promisedDate) : null,
        excludeFromOverdue: invoice.excludeFromOverdue,
      },
      asOf,
    )
    if (overdueFlag) {
      overdue = overdue.plus(remaining)
      overdueCount += 1
    } else {
      open = open.plus(remaining)
      openCount += 1
    }
  }

  const currency = ctx.organization.baseCurrency
  const balanceCopy = describeCustomerBalance(balance, currency)
  return {
    customer,
    asOf,
    balance: toMoneyString(balance, 2),
    balanceLabel: balanceCopy.amountLabel,
    balanceSide: balanceCopy.side,
    balanceTitle: balanceCopy.title,
    balanceExplanation: balanceCopy.explanation,
    balanceDebitLabel: balanceCopy.debitLabel,
    balanceCreditLabel: balanceCopy.creditLabel,
    overdue: toMoneyString(overdue, 2),
    overdueLabel: formatMoney(overdue, currency),
    overdueCount,
    open: toMoneyString(open, 2),
    openLabel: formatMoney(open, currency),
    openCount,
  }
}

export async function listInvoices(ctx: PortalContext, query: ListQuery) {
  const customerId = ctx.portalCustomerId
  const asOf = today(ctx.organization.timeZone)

  const where: Prisma.SalesDocumentWhereInput = {
    orgId: ctx.orgId,
    customerId,
    type: 'INVOICE',
    deletedAt: null,
    status: { notIn: ['DRAFT', 'VOID'] },
    ...(query.q
      ? {
          OR: [
            { number: { contains: query.q, mode: 'insensitive' } },
            { reference: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.salesDocument.findMany({
      where,
      select: {
        id: true,
        number: true,
        date: true,
        dueDate: true,
        promisedDate: true,
        excludeFromOverdue: true,
        status: true,
        total: true,
        applications: { select: { amount: true } },
      },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      ...paginate(query),
    }),
    db.salesDocument.count({ where }),
  ])

  return paged(
    rows.map((row) => {
      const totalAmount = new Decimal(row.total.toString())
      const paid = row.applications.reduce((sum, app) => sum.plus(app.amount.toString()), ZERO)
      const balance = Decimal.max(totalAmount.minus(paid), ZERO)
      const overdue =
        (row.status === 'OPEN' || row.status === 'PARTIAL') &&
        !balance.isZero() &&
        isCollectionOverdue(
          {
            status: row.status,
            dueDate: row.dueDate ? toCalendarDate(row.dueDate) : null,
            promisedDate: row.promisedDate ? toCalendarDate(row.promisedDate) : null,
            excludeFromOverdue: row.excludeFromOverdue,
          },
          asOf,
        )
      return {
        id: row.id,
        number: row.number,
        date: toCalendarDate(row.date),
        dueDate: row.dueDate ? toCalendarDate(row.dueDate) : null,
        status: overdue ? 'OVERDUE' : row.status,
        total: toMoneyString(totalAmount, 2),
        paid: toMoneyString(paid, 2),
        balance: toMoneyString(balance, 2),
      }
    }),
    total,
    query,
  )
}

/** One invoice the portal customer may open — view only, own account. */
export async function getInvoice(ctx: PortalContext, id: string) {
  assertPortalFeatureEnabled(ctx)
  // Own-customer filter is on the query — do not swallow sales.get errors as 404.
  const document = await salesService.get(ctx, id)
  if (
    document.type !== 'INVOICE' ||
    document.customer.id !== ctx.portalCustomerId ||
    document.status === 'DRAFT' ||
    document.status === 'VOID'
  ) {
    throw notFound('Invoice')
  }
  return document
}

export async function listPayments(ctx: PortalContext, query: ListQuery) {
  const customerId = ctx.portalCustomerId
  const where: Prisma.CustomerPaymentWhereInput = {
    orgId: ctx.orgId,
    customerId,
    deletedAt: null,
    status: { not: 'VOID' },
    ...(query.q
      ? {
          OR: [
            { number: { contains: query.q, mode: 'insensitive' } },
            { reference: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.customerPayment.findMany({
      where,
      select: {
        id: true,
        number: true,
        date: true,
        amount: true,
        method: true,
        reference: true,
        status: true,
        applications: {
          select: {
            amount: true,
            invoice: { select: { id: true, number: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      ...paginate(query),
    }),
    db.customerPayment.count({ where }),
  ])

  return paged(
    rows.map((row) => ({
      id: row.id,
      number: row.number,
      date: toCalendarDate(row.date),
      amount: toMoneyString(row.amount.toString(), 2),
      method: row.method,
      reference: row.reference,
      status: row.status,
      invoices: row.applications.map((app) => ({
        id: app.invoice.id,
        number: app.invoice.number,
        amount: toMoneyString(app.amount.toString(), 2),
      })),
    })),
    total,
    query,
  )
}

export async function statement(
  ctx: PortalContext,
  range: { from: CalendarDate; to: CalendarDate },
) {
  return receivables.statement(ctx, ctx.portalCustomerId, range)
}

/** Staff or portal: ensure the caller may read this customer's statement/PDF. */
export function assertCustomerDataAccess(ctx: OrgContext, customerId: string) {
  if (ctx.role === 'CUSTOMER') {
    if (!ctx.portalCustomerId || ctx.portalCustomerId !== customerId) {
      throw forbidden('You can only view your own account.')
    }
    if (!ctx.permissions.has('portal:read')) {
      throw forbidden('This action requires the "portal:read" permission.')
    }
    return
  }
  if (!ctx.permissions.has('report:read')) {
    throw forbidden('This action requires the "report:read" permission.')
  }
}

export function assertInvoicePdfAccess(ctx: OrgContext, documentCustomerId: string) {
  if (ctx.role === 'CUSTOMER') {
    assertOwnCustomer(ctx as PortalContext, documentCustomerId)
    return
  }
  if (!ctx.permissions.has('invoice:read')) {
    throw forbidden('This action requires the "invoice:read" permission.')
  }
}
