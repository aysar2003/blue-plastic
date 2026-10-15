import 'server-only'

import type { Prisma, ProjectStatus } from '@prisma/client'

import { toCalendarDate, toDate } from '@/lib/date'
import { ZERO } from '@/lib/money'
import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { ProjectInput } from '@/lib/validation/project'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { notFound, validation } from '@/server/errors'
import { assignDocumentNumber, numberTaken } from '@/server/sequences'

const LIST_SELECT = {
  id: true,
  number: true,
  name: true,
  status: true,
  siteLocation: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, displayName: true } },
} satisfies Prisma.ProjectSelect

const DETAIL_SELECT = {
  ...LIST_SELECT,
  description: true,
  createdById: true,
  customer: {
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
    },
  },
} satisfies Prisma.ProjectSelect

const PROJECT_ORDER: Record<string, (dir: 'asc' | 'desc') => Prisma.ProjectOrderByWithRelationInput[]> = {
  number: (dir) => [{ number: dir }],
  name: (dir) => [{ name: dir }],
  customer: (dir) => [{ customer: { displayName: dir } }, { updatedAt: 'desc' }],
  status: (dir) => [{ status: dir }, { updatedAt: 'desc' }],
  updatedAt: (dir) => [{ updatedAt: dir }],
}

export type ProjectListOptions = {
  status?: ProjectStatus
  customerId?: string
  sort?: string
  dir?: 'asc' | 'desc'
}

/** Confirm a project belongs to this organisation; returns null when blank. */
export async function resolveProjectId(
  tx: Tx,
  ctx: OrgContext,
  projectId: string | null | undefined,
): Promise<string | null> {
  if (!projectId) return null
  const project = await tx.project.findFirst({
    where: { id: projectId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!project) {
    throw validation('That project was not found.', {
      projectId: ['Choose a project on this company'],
    })
  }
  return project.id
}

export async function list(ctx: OrgContext, query: ListQuery, options: ProjectListOptions = {}) {
  const where: Prisma.ProjectWhereInput = {
    orgId: ctx.orgId,
    ...(options.status ? { status: options.status } : {}),
    ...(options.customerId ? { customerId: options.customerId } : {}),
    ...(query.q
      ? {
          OR: [
            { number: { contains: query.q, mode: 'insensitive' } },
            { name: { contains: query.q, mode: 'insensitive' } },
            { siteLocation: { contains: query.q, mode: 'insensitive' } },
            { customer: { displayName: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const sortKey = options.sort && PROJECT_ORDER[options.sort] ? options.sort : 'updatedAt'
  const dir = options.dir === 'asc' ? 'asc' : 'desc'
  const orderBy = PROJECT_ORDER[sortKey](dir)
  const { skip, take } = paginate(query)

  const [total, rows] = await Promise.all([
    db.project.count({ where }),
    db.project.findMany({
      where,
      select: LIST_SELECT,
      orderBy,
      skip,
      take,
    }),
  ])

  return paged(
    rows.map((row) => ({
      ...row,
      startDate: row.startDate ? toCalendarDate(row.startDate) : null,
      endDate: row.endDate ? toCalendarDate(row.endDate) : null,
    })),
    total,
    query,
  )
}

function sumTotals(
  rows: { type: string; status: string; total: { toString(): string } }[],
  types: Set<string>,
  exclude: Set<string> = new Set(['VOID', 'DECLINED']),
) {
  return rows
    .filter((row) => types.has(row.type) && !exclude.has(row.status))
    .reduce((sum, row) => sum.plus(row.total.toString()), ZERO)
}

export async function get(ctx: OrgContext, id: string) {
  const project = await db.project.findFirst({
    where: { id, orgId: ctx.orgId },
    select: DETAIL_SELECT,
  })
  if (!project) throw notFound('Project')

  const [sales, purchases, creator] = await Promise.all([
    db.salesDocument.findMany({
      where: { orgId: ctx.orgId, projectId: id, deletedAt: null },
      select: {
        id: true,
        type: true,
        number: true,
        date: true,
        status: true,
        total: true,
        customer: { select: { displayName: true } },
      },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
    }),
    db.purchaseDocument.findMany({
      where: { orgId: ctx.orgId, projectId: id, deletedAt: null },
      select: {
        id: true,
        type: true,
        number: true,
        date: true,
        status: true,
        total: true,
        vendor: { select: { displayName: true } },
      },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
    }),
    project.createdById
      ? db.user.findFirst({
          where: { id: project.createdById },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ])

  const quoted = sumTotals(sales, new Set(['ESTIMATE', 'QUOTATION']))
  const ordered = sumTotals(sales, new Set(['SALES_ORDER']))
  const invoiced = sumTotals(sales, new Set(['INVOICE', 'SALES_RECEIPT']))
  const purchaseOrders = sumTotals(purchases, new Set(['PURCHASE_ORDER']))
  const billed = sumTotals(purchases, new Set(['BILL', 'EXPENSE']))

  return {
    id: project.id,
    number: project.number,
    name: project.name,
    status: project.status,
    siteLocation: project.siteLocation,
    description: project.description,
    startDate: project.startDate ? toCalendarDate(project.startDate) : null,
    endDate: project.endDate ? toCalendarDate(project.endDate) : null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    customer: project.customer,
    createdByName: creator?.name ?? null,
    totals: {
      quoted: quoted.toFixed(4),
      ordered: ordered.toFixed(4),
      invoiced: invoiced.toFixed(4),
      purchaseOrders: purchaseOrders.toFixed(4),
      billed: billed.toFixed(4),
    },
    sales: sales.map((row) => ({
      ...row,
      total: row.total.toString(),
      date: toCalendarDate(row.date),
    })),
    purchases: purchases.map((row) => ({
      ...row,
      total: row.total.toString(),
      date: toCalendarDate(row.date),
    })),
  }
}

export type ProjectDetail = Awaited<ReturnType<typeof get>>

async function requireCustomer(tx: Tx, ctx: OrgContext, customerId: string) {
  const customer = await tx.customer.findFirst({
    where: { id: customerId, orgId: ctx.orgId },
    select: { id: true, displayName: true },
  })
  if (!customer) throw notFound('Customer')
  return customer
}

export async function create(ctx: OrgContext, input: ProjectInput) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const customer = await requireCustomer(tx, ctx, input.customerId)
    const number = await assignDocumentNumber(tx, ctx.orgId, 'PROJECT', input.number)
    const clash = await tx.project.findFirst({
      where: { orgId: ctx.orgId, number },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    const project = await tx.project.create({
      data: {
        orgId: ctx.orgId,
        number,
        name: input.name,
        customerId: customer.id,
        siteLocation: input.siteLocation ?? null,
        description: input.description ?? null,
        status: input.status,
        startDate: input.startDate ? toDate(input.startDate) : null,
        endDate: input.endDate ? toDate(input.endDate) : null,
        createdById: ctx.userId,
      },
      select: { id: true, number: true, name: true },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Project',
        entityId: project.id,
        action: 'CREATE',
        after: { number: project.number, name: project.name, customerId: customer.id },
      },
      meta,
    )

    return project
  })
}

export async function update(ctx: OrgContext, id: string, input: ProjectInput) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const existing = await tx.project.findFirst({
      where: { id, orgId: ctx.orgId },
      select: { id: true, number: true },
    })
    if (!existing) throw notFound('Project')

    const customer = await requireCustomer(tx, ctx, input.customerId)
    const number = await assignDocumentNumber(tx, ctx.orgId, 'PROJECT', input.number ?? existing.number)
    const clash = await tx.project.findFirst({
      where: { orgId: ctx.orgId, number, id: { not: id } },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    const project = await tx.project.update({
      where: { id },
      data: {
        number,
        name: input.name,
        customerId: customer.id,
        siteLocation: input.siteLocation ?? null,
        description: input.description ?? null,
        status: input.status,
        startDate: input.startDate ? toDate(input.startDate) : null,
        endDate: input.endDate ? toDate(input.endDate) : null,
      },
      select: { id: true, number: true, name: true },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Project',
        entityId: project.id,
        action: 'UPDATE',
        after: { number: project.number, name: project.name, customerId: customer.id },
      },
      meta,
    )

    return project
  })
}

export async function setStatus(ctx: OrgContext, id: string, status: ProjectStatus) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const existing = await tx.project.findFirst({
      where: { id, orgId: ctx.orgId },
      select: { id: true, status: true },
    })
    if (!existing) throw notFound('Project')

    const project = await tx.project.update({
      where: { id },
      data: { status },
      select: { id: true, number: true, status: true },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Project',
        entityId: project.id,
        action: 'UPDATE',
        before: { status: existing.status },
        after: { status: project.status },
      },
      meta,
    )

    return project
  })
}

/** Lightweight lookup for forms opened with ?project=. */
export async function peek(ctx: OrgContext, id: string) {
  const project = await db.project.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true,
      number: true,
      name: true,
      customerId: true,
      customer: { select: { displayName: true } },
    },
  })
  if (!project) throw notFound('Project')
  return project
}
