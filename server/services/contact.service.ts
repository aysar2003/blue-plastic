import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import type { Prisma } from '@prisma/client'

import { balanceAlertKind, balanceMoment, type BalanceAlert } from '@/lib/balance-alert'
import { Decimal, formatMoney, toMoneyString } from '@/lib/money'
import { formatDate, toCalendarDate, toDate, today } from '@/lib/date'
import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { CustomerInput, VendorInput } from '@/lib/validation/master-data'
import { systemAccountId } from '@/server/accounting/chart-of-accounts'
import { postJournal } from '@/server/accounting/posting'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'

/**
 * Customers and vendors are the same shape with opposite signs: one owes the
 * business, the other is owed by it. Sharing the implementation keeps the two
 * subledgers behaving identically, which is exactly what an accountant expects.
 */
type Side = 'customer' | 'vendor'

/** Optional fields shared by both sides. `displayName` is handled separately: it is required. */
const OPTIONAL_CONTACT_FIELDS = [
  'companyName', 'firstName', 'lastName', 'email', 'phone', 'mobile',
  'taxRegistrationNumber', 'billingLine1', 'billingLine2', 'billingCity',
  'billingRegion', 'billingPostalCode', 'billingCountry', 'paymentTermId', 'notes',
] as const

const CUSTOMER_SELECT = {
  id: true, displayName: true, companyName: true, firstName: true, lastName: true,
  email: true, phone: true, mobile: true, taxRegistrationNumber: true,
  billingLine1: true, billingLine2: true, billingCity: true, billingRegion: true,
  billingPostalCode: true, billingCountry: true,
  shippingLine1: true, shippingLine2: true, shippingCity: true, shippingRegion: true,
  shippingPostalCode: true, shippingCountry: true,
  paymentTermId: true, creditLimit: true, notes: true, salesPerson: true, isActive: true, createdAt: true,
  agreementDate: true, balanceDate: true, balanceTime: true, reminderDays: true,
  paymentTerm: { select: { id: true, name: true, type: true, dueDays: true } },
} satisfies Prisma.CustomerSelect

const CUSTOMER_FILE_SELECT = {
  id: true, kind: true, originalName: true, contentType: true, byteSize: true, createdAt: true,
} satisfies Prisma.CustomerFileSelect

const VENDOR_SELECT = {
  id: true, displayName: true, companyName: true, firstName: true, lastName: true,
  email: true, phone: true, mobile: true, taxRegistrationNumber: true,
  billingLine1: true, billingLine2: true, billingCity: true, billingRegion: true,
  billingPostalCode: true, billingCountry: true,
  paymentTermId: true, defaultExpenseAccountId: true, notes: true, isActive: true, createdAt: true,
  paymentTerm: { select: { id: true, name: true, type: true, dueDays: true } },
  defaultExpenseAccount: { select: { id: true, code: true, name: true } },
} satisfies Prisma.VendorSelect

/* --- Reading -------------------------------------------------------------- */

/** Orderings the list screens offer. Sorting happens here, over every row. */
const CONTACT_ORDER = <T extends { displayName?: unknown }>(sort: string | undefined, dir: 'asc' | 'desc') => {
  switch (sort) {
    case 'name':
      return [{ displayName: dir }] as T[]
    case 'email':
      return [{ email: dir }, { displayName: 'asc' }] as T[]
    case 'phone':
      return [{ phone: dir }, { displayName: 'asc' }] as T[]
    case 'company':
      return [{ companyName: dir }, { displayName: 'asc' }] as T[]
    case 'balance':
      return undefined
    default:
      return undefined
  }
}

export async function listCustomers(
  ctx: OrgContext,
  query: ListQuery,
  options: { includeInactive?: boolean; sort?: string; dir?: 'asc' | 'desc'; ids?: string[] } = {},
) {
  const where: Prisma.CustomerWhereInput = {
    orgId: ctx.orgId,
    ...(options.includeInactive ? {} : { isActive: true }),
    ...(options.ids ? { id: { in: options.ids } } : {}),
    ...(query.q ? { OR: searchTerms(query.q) } : {}),
  }

  const order =
    CONTACT_ORDER<Prisma.CustomerOrderByWithRelationInput>(options.sort, options.dir ?? 'asc') ?? [
      { displayName: 'asc' },
    ]

  // Open balance lives on the ledger, not on the customer row, so a balance
  // sort has to read every matching balance and only then take the page.
  if (options.sort === 'balance') {
    const people = await db.customer.findMany({ where, select: { id: true } })
    const balances = await subledgerBalances(db, ctx, 'customer', people.map((person) => person.id))
    const direction = options.dir === 'desc' ? -1 : 1
    const ordered = people
      .map((person) => ({ id: person.id, balance: balances.get(person.id) ?? new Decimal(0) }))
      .sort((a, b) => a.balance.comparedTo(b.balance) * direction)
    const { skip, take } = paginate(query)
    const slice = ordered.slice(skip, skip + take)
    const found = slice.length
      ? await db.customer.findMany({
          where: { id: { in: slice.map((person) => person.id) } },
          select: CUSTOMER_SELECT,
        })
      : []
    const byId = new Map(found.map((row) => [row.id, row]))
    return paged(
      slice.flatMap((person) => {
        const row = byId.get(person.id)
        return row
          ? [{ ...presentCustomer(row), balance: toMoneyString(person.balance, 2) }]
          : []
      }),
      people.length,
      query,
    )
  }

  const [rows, total] = await Promise.all([
    db.customer.findMany({
      where,
      select: CUSTOMER_SELECT,
      orderBy: order,
      ...paginate(query),
    }),
    db.customer.count({ where }),
  ])

  const balances = await subledgerBalances(db, ctx, 'customer', rows.map((r) => r.id))

  return paged(
    rows.map((row) => ({
      ...presentCustomer(row),
      balance: toMoneyString(balances.get(row.id) ?? 0, 2),
    })),
    total,
    query,
  )
}

/** Vendors who still have an accounts-payable balance. Used before pagination so the filter is the whole list. */
export async function vendorIdsWithBalance(ctx: OrgContext): Promise<string[]> {
  const people = await db.vendor.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: { id: true },
  })
  const balances = await subledgerBalances(
    db,
    ctx,
    'vendor',
    people.map((person) => person.id),
  )
  return [...balances.entries()].filter(([, amount]) => !amount.isZero()).map(([id]) => id)
}

export async function listVendors(
  ctx: OrgContext,
  query: ListQuery,
  options: { includeInactive?: boolean; sort?: string; dir?: 'asc' | 'desc'; ids?: string[] } = {},
) {
  const where: Prisma.VendorWhereInput = {
    orgId: ctx.orgId,
    ...(options.includeInactive ? {} : { isActive: true }),
    ...(options.ids ? { id: { in: options.ids } } : {}),
    ...(query.q ? { OR: searchTerms(query.q) } : {}),
  }

  const order =
    CONTACT_ORDER<Prisma.VendorOrderByWithRelationInput>(options.sort, options.dir ?? 'asc') ?? [
      { displayName: 'asc' },
    ]

  // Payable balance is on the ledger, so sorting by it needs every match first.
  if (options.sort === 'balance') {
    const people = await db.vendor.findMany({ where, select: { id: true } })
    const balances = await subledgerBalances(db, ctx, 'vendor', people.map((person) => person.id))
    const direction = options.dir === 'desc' ? -1 : 1
    const ordered = people
      .map((person) => ({ id: person.id, balance: balances.get(person.id) ?? new Decimal(0) }))
      .sort((a, b) => a.balance.comparedTo(b.balance) * direction)
    const { skip, take } = paginate(query)
    const slice = ordered.slice(skip, skip + take)
    const found = slice.length
      ? await db.vendor.findMany({
          where: { id: { in: slice.map((person) => person.id) } },
          select: VENDOR_SELECT,
        })
      : []
    const byId = new Map(found.map((row) => [row.id, row]))
    return paged(
      slice.flatMap((person) => {
        const row = byId.get(person.id)
        return row ? [{ ...row, balance: toMoneyString(person.balance, 2) }] : []
      }),
      people.length,
      query,
    )
  }

  const [rows, total] = await Promise.all([
    db.vendor.findMany({
      where,
      select: VENDOR_SELECT,
      orderBy: order,
      ...paginate(query),
    }),
    db.vendor.count({ where }),
  ])

  const balances = await subledgerBalances(db, ctx, 'vendor', rows.map((r) => r.id))

  return paged(
    rows.map((row) => ({ ...row, balance: toMoneyString(balances.get(row.id) ?? 0, 2) })),
    total,
    query,
  )
}

export async function getCustomer(ctx: OrgContext, id: string) {
  const customer = await db.customer.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      ...CUSTOMER_SELECT,
      files: { select: CUSTOMER_FILE_SELECT, orderBy: { createdAt: 'asc' as const } },
    },
  })
  if (!customer) throw notFound('Customer')

  const balances = await subledgerBalances(db, ctx, 'customer', [id])
  return {
    ...presentCustomer(customer),
    balance: toMoneyString(balances.get(id) ?? 0, 2),
  }
}

export async function getVendor(ctx: OrgContext, id: string) {
  const vendor = await db.vendor.findFirst({
    where: { id, orgId: ctx.orgId },
    select: VENDOR_SELECT,
  })
  if (!vendor) throw notFound('Vendor')

  const balances = await subledgerBalances(db, ctx, 'vendor', [id])
  return { ...vendor, balance: toMoneyString(balances.get(id) ?? 0, 2) }
}

/**
 * What each contact owes, straight from the ledger.
 *
 * This is the whole argument for R7. The aging report and the AR control account
 * are the same rows read two ways, so they cannot drift apart — there is no
 * separate balance to reconcile, and no reconciliation job to forget to run.
 */
export async function subledgerBalances(
  client: Tx | typeof db,
  ctx: OrgContext,
  side: Side,
  ids: string[],
): Promise<Map<string, Decimal>> {
  if (ids.length === 0) return new Map()

  // Only the control account moves what a contact owes. A name on the bank
  // line is who the cash was with; counting it as well would cancel the
  // receivable or payable and the balance would never change.
  const rows =
    side === 'customer'
      ? await client.$queryRaw<{ id: string; debit: string; credit: string }[]>`
          SELECT l."customerId" AS id,
                 COALESCE(SUM(l.debit), 0)  AS debit,
                 COALESCE(SUM(l.credit), 0) AS credit
            FROM journal_lines l
            JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
            JOIN ledger_accounts a ON a.id = l."accountId"
           WHERE l."orgId" = ${ctx.orgId}
             AND l."customerId" = ANY(${ids})
             AND a.subtype::text = 'ACCOUNTS_RECEIVABLE'
           GROUP BY l."customerId"
        `
      : await client.$queryRaw<{ id: string; debit: string; credit: string }[]>`
          SELECT l."vendorId" AS id,
                 COALESCE(SUM(l.debit), 0)  AS debit,
                 COALESCE(SUM(l.credit), 0) AS credit
            FROM journal_lines l
            JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
            JOIN ledger_accounts a ON a.id = l."accountId"
           WHERE l."orgId" = ${ctx.orgId}
             AND l."vendorId" = ANY(${ids})
             AND a.subtype::text = 'ACCOUNTS_PAYABLE'
           GROUP BY l."vendorId"
        `

  return new Map(
    rows.map((row) => [
      row.id,
      // Receivables are debit balances, payables are credit balances. Both are
      // shown positive when the contact owes what you would expect them to.
      side === 'customer'
        ? new Decimal(row.debit).minus(row.credit)
        : new Decimal(row.credit).minus(row.debit),
    ]),
  )
}

/* --- Writing -------------------------------------------------------------- */

export async function createCustomer(ctx: OrgContext, input: CustomerInput) {
  await assertNameFree(ctx, 'customer', input.displayName)
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        orgId: ctx.orgId,
        ...pickContact(input),
        shippingLine1: input.shippingLine1 ?? null,
        shippingLine2: input.shippingLine2 ?? null,
        shippingCity: input.shippingCity ?? null,
        shippingRegion: input.shippingRegion ?? null,
        shippingPostalCode: input.shippingPostalCode ?? null,
        shippingCountry: input.shippingCountry ?? null,
        creditLimit: input.creditLimit ?? null,
        salesPerson: input.salesPerson ?? null,
        agreementDate: input.agreementDate ? toDate(input.agreementDate) : null,
        balanceDate: input.openingBalanceDate ? toDate(input.openingBalanceDate) : null,
        balanceTime: input.balanceTime ?? null,
        reminderDays: input.reminderDays ?? null,
      },
      select: { id: true, displayName: true },
    })

    await writeAudit(
      tx,
      ctx,
      { entity: 'Customer', entityId: customer.id, action: 'CREATE', after: customer },
      meta,
    )

    await postOpeningBalance(tx, ctx, 'customer', customer.id, customer.displayName, input)
    return customer
  })
}

export async function createVendor(ctx: OrgContext, input: VendorInput) {
  await assertNameFree(ctx, 'vendor', input.displayName)
  await assertExpenseAccount(ctx, input.defaultExpenseAccountId ?? null)
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const vendor = await tx.vendor.create({
      data: {
        orgId: ctx.orgId,
        ...pickContact(input),
        defaultExpenseAccountId: input.defaultExpenseAccountId ?? null,
      },
      select: { id: true, displayName: true },
    })

    await writeAudit(
      tx,
      ctx,
      { entity: 'Vendor', entityId: vendor.id, action: 'CREATE', after: vendor },
      meta,
    )

    await postOpeningBalance(tx, ctx, 'vendor', vendor.id, vendor.displayName, input)
    return vendor
  })
}

export async function updateCustomer(ctx: OrgContext, input: CustomerInput & { id: string }) {
  const before = await db.customer.findFirst({
    where: { id: input.id, orgId: ctx.orgId },
    select: CUSTOMER_SELECT,
  })
  if (!before) throw notFound('Customer')
  if (before.displayName !== input.displayName) {
    await assertNameFree(ctx, 'customer', input.displayName, input.id)
  }

  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const after = await tx.customer.update({
      where: { id: input.id },
      data: {
        ...pickContact(input),
        shippingLine1: input.shippingLine1 ?? null,
        shippingLine2: input.shippingLine2 ?? null,
        shippingCity: input.shippingCity ?? null,
        shippingRegion: input.shippingRegion ?? null,
        shippingPostalCode: input.shippingPostalCode ?? null,
        shippingCountry: input.shippingCountry ?? null,
        creditLimit: input.creditLimit ?? null,
        salesPerson: input.salesPerson ?? null,
        agreementDate: input.agreementDate ? toDate(input.agreementDate) : null,
        balanceDate: input.openingBalanceDate ? toDate(input.openingBalanceDate) : null,
        balanceTime: input.balanceTime ?? null,
        reminderDays: input.reminderDays ?? null,
      },
      select: { id: true, displayName: true },
    })

    await writeAudit(
      tx,
      ctx,
      { entity: 'Customer', entityId: after.id, action: 'UPDATE', before, after },
      meta,
    )
    return after
  })
}

export async function updateVendor(ctx: OrgContext, input: VendorInput & { id: string }) {
  const before = await db.vendor.findFirst({
    where: { id: input.id, orgId: ctx.orgId },
    select: VENDOR_SELECT,
  })
  if (!before) throw notFound('Vendor')
  if (before.displayName !== input.displayName) {
    await assertNameFree(ctx, 'vendor', input.displayName, input.id)
  }
  await assertExpenseAccount(ctx, input.defaultExpenseAccountId ?? null)

  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const after = await tx.vendor.update({
      where: { id: input.id },
      data: {
        ...pickContact(input),
        defaultExpenseAccountId: input.defaultExpenseAccountId ?? null,
      },
      select: { id: true, displayName: true },
    })

    await writeAudit(
      tx,
      ctx,
      { entity: 'Vendor', entityId: after.id, action: 'UPDATE', before, after },
      meta,
    )
    return after
  })
}

/**
 * Archive or restore. Contacts are never deleted — a posted line references them
 * forever, and the foreign key from journal_lines refuses it anyway.
 *
 * Archiving is blocked while a balance is outstanding: hiding a customer who
 * still owes money is how a receivable gets forgotten.
 */
export async function setActive(ctx: OrgContext, side: Side, ids: string[], isActive: boolean) {
  const meta = await requestMeta()

  if (!isActive) {
    const balances = await subledgerBalances(db, ctx, side, ids)
    const outstanding = [...balances.entries()].filter(([, balance]) => !balance.isZero())

    if (outstanding.length > 0) {
      const names =
        side === 'customer'
          ? await db.customer.findMany({
              where: { id: { in: outstanding.map(([id]) => id) } },
              select: { displayName: true },
            })
          : await db.vendor.findMany({
              where: { id: { in: outstanding.map(([id]) => id) } },
              select: { displayName: true },
            })

      throw precondition(
        `${names.map((n) => n.displayName).join(', ')} still ${names.length === 1 ? 'has' : 'have'} an ` +
          `outstanding balance. Settle or write it off before archiving, or it will vanish from view while ` +
          `remaining in the accounts.`,
      )
    }
  }

  return db.$transaction(async (tx) => {
    const result =
      side === 'customer'
        ? await tx.customer.updateMany({ where: { id: { in: ids }, orgId: ctx.orgId }, data: { isActive } })
        : await tx.vendor.updateMany({ where: { id: { in: ids }, orgId: ctx.orgId }, data: { isActive } })

    for (const id of ids) {
      await writeAudit(
        tx,
        ctx,
        {
          entity: side === 'customer' ? 'Customer' : 'Vendor',
          entityId: id,
          action: isActive ? 'RESTORE' : 'ARCHIVE',
          after: { isActive },
        },
        meta,
      )
    }

    return { count: result.count }
  })
}

/* --- Opening balances ----------------------------------------------------- */

/**
 * An opening balance is a journal, never a column.
 *
 * Positive — what is owed the natural way:
 *   Customer: debit Accounts Receivable, credit Opening Balance Equity.
 *   Vendor:   debit Opening Balance Equity, credit Accounts Payable.
 *
 * Negative — a credit already on the books (they overpaid, or we overpaid):
 *   Customer: credit Accounts Receivable, debit Opening Balance Equity.
 *   Vendor:   debit Accounts Payable, credit Opening Balance Equity.
 *
 * The AR/AP line carries its counterparty, which is what R7 demands and what
 * makes the balance show up on the aging report as well as in the control
 * account.
 */
async function postOpeningBalance(
  tx: Tx,
  ctx: OrgContext,
  side: Side,
  id: string,
  name: string,
  input: { openingBalance?: string | null; openingBalanceDate?: string | null; balanceTime?: string | null },
) {
  if (!input.openingBalance) return
  const signed = new Decimal(input.openingBalance)
  if (signed.isZero()) return

  const amount = signed.abs()
  const isCredit = signed.isNegative()

  const control = await systemAccountId(
    tx,
    ctx.orgId,
    side === 'customer' ? 'ACCOUNTS_RECEIVABLE' : 'ACCOUNTS_PAYABLE',
  )
  const equity = await systemAccountId(tx, ctx.orgId, 'OPENING_BALANCE_EQUITY')
  const date = input.openingBalanceDate ?? today(ctx.organization.timeZone)
  const kind = isCredit ? 'Opening credit' : 'Opening balance'
  const memo = input.balanceTime ? `${kind} — ${name} (${input.balanceTime})` : `${kind} — ${name}`

  const lines =
    side === 'customer'
      ? isCredit
        ? [
            { accountId: equity, debit: amount },
            { accountId: control, credit: amount, customerId: id },
          ]
        : [
            { accountId: control, debit: amount, customerId: id },
            { accountId: equity, credit: amount },
          ]
      : isCredit
        ? [
            { accountId: control, debit: amount, vendorId: id },
            { accountId: equity, credit: amount },
          ]
        : [
            { accountId: equity, debit: amount },
            { accountId: control, credit: amount, vendorId: id },
          ]

  await postJournal(tx, ctx, {
    date,
    memo,
    sourceType: 'OPENING_BALANCE',
    sourceId: id,
    lines,
  })
}

/* --- Helpers -------------------------------------------------------------- */

type PresentedFile = {
  id: string
  kind: 'PHOTO' | 'AGREEMENT'
  originalName: string
  contentType: string
  byteSize: number
  createdAt: Date
}

/**
 * Customers whose 3, 5, or 7 day warning has started, and who still owe a balance.
 * Cached ~60s per organisation so AppShell does not recompute on every page.
 */
export function listBalanceAlerts(ctx: OrgContext): Promise<BalanceAlert[]> {
  return cachedBalanceAlerts(ctx.orgId, ctx.organization.timeZone, ctx.organization.baseCurrency)
}

const cachedBalanceAlerts = cache((orgId: string, timeZone: string, baseCurrency: string) =>
  unstable_cache(
    () => queryBalanceAlerts(orgId, timeZone, baseCurrency),
    ['balance-alerts', orgId, timeZone, baseCurrency],
    { revalidate: 60 },
  )(),
)

async function queryBalanceAlerts(
  orgId: string,
  timeZone: string,
  baseCurrency: string,
): Promise<BalanceAlert[]> {
  const people = await db.customer.findMany({
    where: { orgId, isActive: true, reminderDays: { in: [3, 5, 7] } },
    select: {
      id: true,
      displayName: true,
      balanceDate: true,
      agreementDate: true,
      balanceTime: true,
      reminderDays: true,
    },
  })

  const now = Date.now()
  const due = people.flatMap((person) => {
    const date = person.balanceDate ?? person.agreementDate
    if (!date || person.reminderDays == null) return []
    const moment = balanceMoment(toCalendarDate(date), person.balanceTime, timeZone)
    const kind = balanceAlertKind(now, moment.getTime(), person.reminderDays)
    if (kind === 'waiting') return []
    const when = person.balanceTime
      ? `${formatDate(toCalendarDate(date))} ${person.balanceTime}`
      : formatDate(toCalendarDate(date))
    return [{ id: person.id, name: person.displayName, kind, when, reminderDays: person.reminderDays }]
  })
  if (due.length === 0) return []

  const balances = await subledgerBalances(
    db,
    { orgId } as OrgContext,
    'customer',
    due.map((person) => person.id),
  )

  return due
    .flatMap((person) => {
      const amount = balances.get(person.id) ?? new Decimal(0)
      if (!amount.greaterThan('0.005')) return []
      return [
        {
          customerId: person.id,
          name: person.name,
          amount: formatMoney(amount, baseCurrency),
          kind: person.kind,
          when: person.when,
          reminderDays: person.reminderDays,
        },
      ]
    })
    .sort((a, b) => Number(b.kind === 'reached') - Number(a.kind === 'reached') || a.when.localeCompare(b.when))
    .slice(0, 20)
}

function presentCustomer<
  T extends {
    creditLimit: { toString(): string } | null
    agreementDate: Date | null
    balanceDate: Date | null
    files?: PresentedFile[]
  },
>(row: T) {
  const { files, ...rest } = row
  return {
    ...rest,
    creditLimit: row.creditLimit?.toString() ?? null,
    agreementDate: row.agreementDate ? toCalendarDate(row.agreementDate) : null,
    balanceDate: row.balanceDate ? toCalendarDate(row.balanceDate) : null,
    files: (files ?? []).map((file) => ({
      id: file.id,
      kind: file.kind,
      originalName: file.originalName,
      contentType: file.contentType,
      byteSize: file.byteSize,
      createdAt: file.createdAt.toISOString(),
    })),
  }
}

function searchTerms(q: string) {
  return [
    { displayName: { contains: q, mode: 'insensitive' as const } },
    { companyName: { contains: q, mode: 'insensitive' as const } },
    { email: { contains: q, mode: 'insensitive' as const } },
    { phone: { contains: q, mode: 'insensitive' as const } },
  ]
}

function pickContact(input: CustomerInput | VendorInput) {
  const optional: Record<string, string | null> = {}
  for (const field of OPTIONAL_CONTACT_FIELDS) {
    const value = (input as Record<string, unknown>)[field]
    optional[field] = typeof value === 'string' && value !== '' ? value : null
  }

  return { displayName: input.displayName, ...optional } as {
    displayName: string
  } & Record<(typeof OPTIONAL_CONTACT_FIELDS)[number], string | null>
}

async function assertNameFree(ctx: OrgContext, side: Side, name: string, selfId?: string) {
  const existing =
    side === 'customer'
      ? await db.customer.findUnique({
          where: { orgId_displayName: { orgId: ctx.orgId, displayName: name } },
          select: { id: true },
        })
      : await db.vendor.findUnique({
          where: { orgId_displayName: { orgId: ctx.orgId, displayName: name } },
          select: { id: true },
        })

  if (existing && existing.id !== selfId) {
    throw conflict(
      `Another ${side} is already called "${name}". Two identical names on an aging report help nobody.`,
    )
  }
}

async function assertExpenseAccount(ctx: OrgContext, accountId: string | null) {
  if (!accountId) return
  const account = await db.ledgerAccount.findFirst({
    where: { id: accountId, orgId: ctx.orgId },
    select: { type: true, name: true },
  })
  if (!account) throw notFound('Account')
  if (account.type !== 'EXPENSE' && account.type !== 'ASSET') {
    throw validation(
      `"${account.name}" is not an expense or asset account, so a bill cannot be categorised to it by default.`,
      { defaultExpenseAccountId: ['Choose an expense or asset account'] },
    )
  }
}
