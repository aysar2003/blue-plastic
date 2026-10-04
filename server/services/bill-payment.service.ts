import 'server-only'
import type { Prisma } from '@prisma/client'

import { toDate, today, type CalendarDate } from '@/lib/date'
import { Decimal, toMoneyString, ZERO } from '@/lib/money'
import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { BillPaymentInput } from '@/lib/validation/purchases'
import { buildBillPaymentJournal } from '@/server/accounting/builders/purchases'
import { systemAccountId } from '@/server/accounting/chart-of-accounts'
import { softDeleteDocument } from '@/server/accounting/deletion'
import { postJournal } from '@/server/accounting/posting'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import { assignDocumentNumber, numberTaken } from '@/server/sequences'
import { outstandingBalances, refreshStatus } from '@/server/services/purchase.service'

const PAYMENT_SELECT = {
  id: true, number: true, date: true, amount: true, method: true, reference: true,
  memo: true, status: true, journalId: true, voidedAt: true, voidReason: true,
  vendor: { select: { id: true, displayName: true } },
  paymentAccount: { select: { id: true, code: true, name: true } },
} satisfies Prisma.BillPaymentSelect

/** Orderings the list screen offers. Sorting happens here, over every row. */
const PAYMENT_ORDER: Record<
  string,
  (dir: 'asc' | 'desc') => Prisma.BillPaymentOrderByWithRelationInput[]
> = {
  number: (dir) => [{ number: dir }],
  date: (dir) => [{ date: dir }, { number: dir }],
  vendor: (dir) => [{ vendor: { displayName: dir } }, { date: 'desc' }],
  amount: (dir) => [{ amount: dir }, { date: 'desc' }],
  method: (dir) => [{ method: dir }, { date: 'desc' }],
}

export async function list(
  ctx: OrgContext,
  query: ListQuery,
  options: {
    vendorId?: string
    sort?: string
    dir?: 'asc' | 'desc'
    from?: CalendarDate
    to?: CalendarDate
  } = {},
) {
  const where: Prisma.BillPaymentWhereInput = {
    orgId: ctx.orgId,
    ...(options.vendorId ? { vendorId: options.vendorId } : {}),
    ...(options.from || options.to
      ? {
          date: {
            ...(options.from ? { gte: toDate(options.from) } : {}),
            ...(options.to ? { lte: toDate(options.to) } : {}),
          },
        }
      : {}),
    ...(query.q
      ? {
          OR: [
            { number: { contains: query.q, mode: 'insensitive' } },
            { reference: { contains: query.q, mode: 'insensitive' } },
            { vendor: { displayName: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.billPayment.findMany({
      where,
      select: { ...PAYMENT_SELECT, applications: { select: { amount: true } } },
      orderBy:
        (options.sort ? PAYMENT_ORDER[options.sort]?.(options.dir ?? 'asc') : undefined) ??
        [{ date: 'desc' }, { number: 'desc' }],
      ...paginate(query),
    }),
    db.billPayment.count({ where }),
  ])

  return paged(
    rows.map((row) => {
      const applied = row.applications.reduce((sum, a) => sum.plus(a.amount.toString()), ZERO)
      const amount = new Decimal(row.amount.toString())
      return {
        ...row,
        amount: amount.toString(),
        applied: toMoneyString(applied, 2),
        unapplied: toMoneyString(amount.minus(applied), 2),
      }
    }),
    total,
    query,
  )
}

/**
 * The bills a payment could still be put against, oldest first.
 *
 * Oldest first is not a cosmetic ordering: it is the order bills are settled in,
 * so the list is already in the order somebody works down it on pay day. Each
 * row carries what the bill was for as well as what is left, because "pay 400 of
 * 1,200" and "pay 400 of 400" are different decisions.
 */
export async function openBillsFor(ctx: OrgContext, vendorId: string) {
  const bills = await db.purchaseDocument.findMany({
    where: { orgId: ctx.orgId, vendorId, type: 'BILL', status: { in: ['OPEN', 'PARTIAL'] } },
    select: { id: true, number: true, date: true, dueDate: true, total: true, reference: true },
    orderBy: [{ dueDate: 'asc' }, { date: 'asc' }],
  })

  const balances = await outstandingBalances(db, bills.map((bill) => bill.id))
  const now = toDate(today(ctx.organization.timeZone))

  return bills
    .map((bill) => {
      const balance = balances.get(bill.id) ?? ZERO
      const total = new Decimal(bill.total.toString())
      return {
        ...bill,
        total: total.toString(),
        paid: toMoneyString(total.minus(balance), 2),
        balance: toMoneyString(balance, 2),
        daysOverdue: bill.dueDate
          ? Math.floor((now.getTime() - bill.dueDate.getTime()) / 86_400_000)
          : 0,
      }
    })
    .filter((bill) => Number(bill.balance) > 0)
}

/**
 * Vendor credits with something left on them.
 *
 * Shown beside the bills on the payment screen because they are the other way of
 * settling one, and a credit nobody can see is a credit nobody uses. Applying a
 * credit posts nothing — the ledger already carries it — so it is a separate
 * action from the payment itself.
 */
export async function openCreditsFor(ctx: OrgContext, vendorId: string) {
  const credits = await db.purchaseDocument.findMany({
    where: {
      orgId: ctx.orgId,
      vendorId,
      type: 'VENDOR_CREDIT',
      status: { in: ['OPEN', 'PARTIAL'] },
    },
    select: { id: true, number: true, date: true, total: true, reference: true },
    orderBy: { date: 'asc' },
  })

  const rows = await Promise.all(
    credits.map(async (credit) => {
      const applied = await db.purchaseApplication.aggregate({
        where: { creditDocumentId: credit.id },
        _sum: { amount: true },
      })
      const remaining = new Decimal(credit.total.toString()).minus(
        applied._sum.amount?.toString() ?? '0',
      )
      return {
        id: credit.id,
        number: credit.number,
        date: credit.date,
        reference: credit.reference,
        total: credit.total.toString(),
        remaining: toMoneyString(remaining, 2),
      }
    }),
  )

  return rows.filter((credit) => Number(credit.remaining) > 0)
}

/**
 * Pay one or more bills.
 *
 * The mirror of a customer payment: its own document, which may settle several
 * bills, part of one, or none. Money paid on account that has not been matched to
 * a bill sits as a debit on payables, which is exactly what it is — the vendor
 * owes it back until something is invoiced against it.
 */
export async function create(ctx: OrgContext, input: BillPaymentInput) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const vendor = await tx.vendor.findFirst({
      where: { id: input.vendorId, orgId: ctx.orgId },
      select: { id: true, displayName: true },
    })
    if (!vendor) throw notFound('Vendor')

    const account = await tx.ledgerAccount.findFirst({
      where: { id: input.paymentAccountId, orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true, subtype: true, type: true },
    })
    if (!account) throw notFound('Payment account')
    // Any balance-sheet account can pay a bill: petty cash, a mobile-money
    // float, a director's loan. What cannot is an income or expense account —
    // money does not leave one, and recording it that way would post the
    // settlement as if it were a fresh cost.
    if (account.type !== 'ASSET' && account.type !== 'LIABILITY') {
      throw validation(
        `"${account.name}" is an ${account.type.toLowerCase()} account, so money cannot be paid out of it.`,
        { paymentAccountId: ['Choose a bank, cash, credit card or other balance-sheet account'] },
      )
    }

    const amount = new Decimal(input.amount)
    const applications = input.applications
      .map((application) => ({ ...application, amount: new Decimal(application.amount) }))
      .filter((application) => application.amount.greaterThan(0))

    const appliedTotal = applications.reduce((sum, a) => sum.plus(a.amount), ZERO)
    if (appliedTotal.greaterThan(amount)) {
      throw validation(
        `You are applying ${toMoneyString(appliedTotal, 2)} of a ${toMoneyString(amount, 2)} payment.`,
      )
    }

    const number = await assignDocumentNumber(tx, ctx.orgId, 'BILL_PAYMENT', input.number)
    const clash = await tx.billPayment.findFirst({
      where: { orgId: ctx.orgId, number },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    const payment = await tx.billPayment.create({
      data: {
        orgId: ctx.orgId,
        number,
        vendorId: vendor.id,
        date: toDate(input.date),
        amount: amount.toFixed(4),
        method: input.method,
        reference: input.reference ?? null,
        memo: input.memo ?? null,
        paymentAccountId: account.id,
        currencyCode: ctx.organization.baseCurrency,
        createdById: ctx.userId,
      },
      select: { id: true, number: true },
    })

    const journal = await postJournal(
      tx,
      ctx,
      buildBillPaymentJournal({
        date: input.date,
        number: payment.number,
        paymentId: payment.id,
        vendorId: vendor.id,
        amount,
        paymentAccountId: account.id,
        payableAccountId: await systemAccountId(tx, ctx.orgId, 'ACCOUNTS_PAYABLE'),
        memo: input.memo,
      }),
    )

    await tx.billPayment.update({ where: { id: payment.id }, data: { journalId: journal.id } })

    for (const application of applications) {
      await assertBillBelongsToVendor(tx, ctx, application.billId, vendor.id)
      await tx.purchaseApplication.create({
        data: {
          orgId: ctx.orgId,
          paymentId: payment.id,
          billId: application.billId,
          amount: application.amount.toFixed(4),
        },
      })
      await refreshStatus(tx, application.billId)
    }

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'BillPayment',
        entityId: payment.id,
        action: 'CREATE',
        after: { number: payment.number, amount: amount.toString(), bills: applications.length },
      },
      meta,
    )

    return { id: payment.id, number: payment.number }
  })
}

/** Put a vendor credit against one or more bills. Posts nothing: the credit is already in the ledger. */
export async function applyCredit(
  ctx: OrgContext,
  creditDocumentId: string,
  applications: { billId: string; amount: string }[],
) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const credit = await tx.purchaseDocument.findFirst({
      where: { id: creditDocumentId, orgId: ctx.orgId, type: 'VENDOR_CREDIT' },
      select: { id: true, number: true, status: true, vendorId: true, total: true },
    })
    if (!credit) throw notFound('Vendor credit')
    if (credit.status === 'VOID' || credit.status === 'DRAFT') {
      throw precondition(`${credit.number} is ${credit.status.toLowerCase()} and cannot be applied.`)
    }

    for (const application of applications) {
      const amount = new Decimal(application.amount)
      if (!amount.greaterThan(0)) continue

      await assertBillBelongsToVendor(tx, ctx, application.billId, credit.vendorId)
      await tx.purchaseApplication.create({
        data: {
          orgId: ctx.orgId,
          creditDocumentId: credit.id,
          billId: application.billId,
          amount: amount.toFixed(4),
        },
      })
      await refreshStatus(tx, application.billId)
    }

    const applied = await tx.purchaseApplication.aggregate({
      where: { creditDocumentId: credit.id },
      _sum: { amount: true },
    })
    const remaining = new Decimal(credit.total.toString()).minus(applied._sum.amount?.toString() ?? '0')
    if (remaining.lessThanOrEqualTo(0)) {
      await tx.purchaseDocument.update({ where: { id: credit.id }, data: { status: 'CLOSED' } })
    }

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'PurchaseDocument',
        entityId: credit.id,
        action: 'UPDATE',
        after: { appliedTo: applications.length, remaining: remaining.toString() },
      },
      meta,
    )

    return { id: credit.id, number: credit.number }
  })
}

/**
 * Delete a vendor payment: withdraw its journal, release the bills it settled.
 *
 * Nothing is physically removed — see `server/accounting/deletion.ts`.
 */
export async function remove(ctx: OrgContext, id: string, reason?: string | null) {
  return db.$transaction(async (tx) => {
    const payment = await tx.billPayment.findFirst({
      where: { id, orgId: ctx.orgId, deletedAt: undefined },
      select: {
        id: true, number: true, status: true, journalId: true, amount: true, deletedAt: true,
        applications: { select: { billId: true } },
      },
    })
    if (!payment) throw notFound('Payment')
    if (payment.deletedAt) return { id, number: payment.number }

    const billIds = payment.applications.map((application) => application.billId)
    await tx.purchaseApplication.deleteMany({ where: { paymentId: id } })

    await softDeleteDocument(tx, ctx, {
      mark: (stamp) => tx.billPayment.update({ where: { id }, data: stamp }),
      entity: 'BillPayment',
      id,
      number: payment.number,
      journalIds: [payment.journalId],
      reason,
      before: {
        amount: payment.amount.toString(),
        status: payment.status,
        applicationsReleased: billIds.length,
      },
    })

    for (const billId of billIds) await refreshStatus(tx, billId)

    return { id, number: payment.number }
  })
}

async function assertBillBelongsToVendor(tx: Tx, ctx: OrgContext, billId: string, vendorId: string) {
  const bill = await tx.purchaseDocument.findFirst({
    where: { id: billId, orgId: ctx.orgId, type: 'BILL' },
    select: { id: true, number: true, vendorId: true },
  })
  if (!bill) throw notFound('Bill')

  if (bill.vendorId !== vendorId) {
    throw validation(
      `Bill ${bill.number} belongs to a different vendor. ` +
        `Settling one vendor's bill with another's money puts both subledgers wrong.`,
    )
  }
}
