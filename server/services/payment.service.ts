import 'server-only'
import type { Prisma } from '@prisma/client'

import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { Decimal, toMoneyString, ZERO } from '@/lib/money'
import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { PaymentInput } from '@/lib/validation/sales'
import { systemAccountId } from '@/server/accounting/chart-of-accounts'
import { buildCustomerPaymentJournal } from '@/server/accounting/builders/sales'
import { softDeleteDocument } from '@/server/accounting/deletion'
import { removeDepositWithin } from '@/server/services/banking.service'
import { postJournal, reverseJournal } from '@/server/accounting/posting'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import { assignDocumentNumber, numberTaken } from '@/server/sequences'
import { outstandingBalances, refreshStatus } from '@/server/services/sales.service'

const PAYMENT_SELECT = {
  id: true, number: true, date: true, amount: true, method: true, reference: true,
  memo: true, status: true, journalId: true, voidedAt: true, voidReason: true,
  customer: { select: { id: true, displayName: true, email: true, phone: true } },
  depositAccount: { select: { id: true, code: true, name: true } },
} satisfies Prisma.CustomerPaymentSelect

/** Orderings the list screen offers. Sorting happens here, over every row. */
const PAYMENT_ORDER: Record<
  string,
  (dir: 'asc' | 'desc') => Prisma.CustomerPaymentOrderByWithRelationInput[]
> = {
  number: (dir) => [{ number: dir }],
  date: (dir) => [{ date: dir }, { number: dir }],
  customer: (dir) => [{ customer: { displayName: dir } }, { date: 'desc' }],
  amount: (dir) => [{ amount: dir }, { date: 'desc' }],
  method: (dir) => [{ method: dir }, { date: 'desc' }],
}

export async function list(
  ctx: OrgContext,
  query: ListQuery,
  options: {
    customerId?: string
    sort?: string
    dir?: 'asc' | 'desc'
    from?: CalendarDate
    to?: CalendarDate
  } = {},
) {
  const where: Prisma.CustomerPaymentWhereInput = {
    orgId: ctx.orgId,
    ...(options.customerId ? { customerId: options.customerId } : {}),
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
            { customer: { displayName: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.customerPayment.findMany({
      where,
      select: { ...PAYMENT_SELECT, applications: { select: { amount: true } } },
      orderBy:
        (options.sort ? PAYMENT_ORDER[options.sort]?.(options.dir ?? 'asc') : undefined) ??
        [{ date: 'desc' }, { number: 'desc' }],
      ...paginate(query),
    }),
    db.customerPayment.count({ where }),
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

export async function get(ctx: OrgContext, id: string) {
  const payment = await db.customerPayment.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      ...PAYMENT_SELECT,
      applications: {
        select: {
          id: true,
          amount: true,
          invoice: { select: { id: true, number: true, date: true, total: true, dueDate: true } },
        },
      },
      journal: { select: { id: true, journalNumber: true } },
    },
  })
  if (!payment) throw notFound('Payment')

  const applied = payment.applications.reduce((sum, a) => sum.plus(a.amount.toString()), ZERO)
  const amount = new Decimal(payment.amount.toString())

  return {
    ...payment,
    amount: amount.toString(),
    applied: toMoneyString(applied, 2),
    unapplied: toMoneyString(amount.minus(applied), 2),
    applications: payment.applications.map((a) => ({
      ...a,
      amount: a.amount.toString(),
      invoice: { ...a.invoice, total: a.invoice.total.toString() },
    })),
  }
}

/** The invoices a payment could still be put against, oldest first. */
export async function openInvoicesFor(ctx: OrgContext, customerId: string) {
  const invoices = await db.salesDocument.findMany({
    where: {
      orgId: ctx.orgId,
      customerId,
      type: 'INVOICE',
      status: { in: ['OPEN', 'PARTIAL'] },
    },
    select: { id: true, number: true, date: true, dueDate: true, total: true },
    orderBy: { date: 'asc' },
  })

  const balances = await outstandingBalances(db, invoices.map((invoice) => invoice.id))

  return invoices
    .map((invoice) => ({
      ...invoice,
      total: invoice.total.toString(),
      balance: toMoneyString(balances.get(invoice.id) ?? ZERO, 2),
    }))
    .filter((invoice) => Number(invoice.balance) > 0)
}

/**
 * Outstanding invoices for editing a payment: current open balances, plus what
 * this payment already applied (so those invoices stay on the form to re-apply).
 */
export async function invoicesForEdit(ctx: OrgContext, paymentId: string) {
  const payment = await get(ctx, paymentId)
  const open = await openInvoicesFor(ctx, payment.customer.id)
  const byId = new Map(
    open.map((invoice) => [
      invoice.id,
      {
        id: invoice.id,
        number: invoice.number,
        date: invoice.date,
        dueDate: invoice.dueDate,
        total: invoice.total,
        balance: invoice.balance,
      },
    ]),
  )

  for (const application of payment.applications) {
    const applied = new Decimal(application.amount)
    const existing = byId.get(application.invoice.id)
    if (existing) {
      byId.set(application.invoice.id, {
        ...existing,
        balance: toMoneyString(new Decimal(existing.balance).plus(applied), 2),
      })
      continue
    }
    byId.set(application.invoice.id, {
      id: application.invoice.id,
      number: application.invoice.number,
      date: application.invoice.date,
      dueDate: application.invoice.dueDate,
      total: application.invoice.total,
      balance: toMoneyString(applied, 2),
    })
  }

  return [...byId.values()].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
}

/**
 * Record money received.
 *
 * A payment is its own document, not a flag on an invoice. It may settle several
 * invoices, part of one, or none at all — unapplied cash stays on the balance
 * sheet as a customer credit, which is where it belongs until someone decides
 * what it was for.
 */
export async function create(ctx: OrgContext, input: PaymentInput) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, orgId: ctx.orgId },
      select: { id: true, displayName: true, isActive: true },
    })
    if (!customer) throw notFound('Customer')

    const deposit = await tx.ledgerAccount.findFirst({
      where: { id: input.depositAccountId, orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true, subtype: true },
    })
    if (!deposit) throw notFound('Deposit account')
    if (deposit.subtype !== 'BANK' && deposit.subtype !== 'UNDEPOSITED_FUNDS') {
      throw validation(
        `"${deposit.name}" is not a bank or undeposited funds account, so money cannot be received into it.`,
        { depositAccountId: ['Choose a bank or undeposited funds account'] },
      )
    }

    const amount = new Decimal(input.amount)
    const applications = input.applications
      .map((application) => ({ ...application, amount: new Decimal(application.amount) }))
      .filter((application) => application.amount.greaterThan(0))

    const appliedTotal = applications.reduce((sum, a) => sum.plus(a.amount), ZERO)
    if (appliedTotal.greaterThan(amount)) {
      throw validation(
        `You are applying ${toMoneyString(appliedTotal, 2)} of a ${toMoneyString(amount, 2)} payment. ` +
          `Reduce the applied amounts, or increase the payment.`,
      )
    }

    const number = await assignDocumentNumber(tx, ctx.orgId, 'CUSTOMER_PAYMENT', input.number)
    const clash = await tx.customerPayment.findFirst({
      where: { orgId: ctx.orgId, number },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    const payment = await tx.customerPayment.create({
      data: {
        orgId: ctx.orgId,
        number,
        customerId: customer.id,
        date: toDate(input.date),
        amount: amount.toFixed(4),
        method: input.method,
        reference: input.reference ?? null,
        memo: input.memo ?? null,
        depositAccountId: deposit.id,
        currencyCode: ctx.organization.baseCurrency,
        createdById: ctx.userId,
      },
      select: { id: true, number: true },
    })

    const journal = await postJournal(
      tx,
      ctx,
      buildCustomerPaymentJournal({
        date: input.date,
        number: payment.number,
        paymentId: payment.id,
        customerId: customer.id,
        amount,
        depositAccountId: deposit.id,
        receivableAccountId: await systemAccountId(tx, ctx.orgId, 'ACCOUNTS_RECEIVABLE'),
        memo: input.memo,
      }),
    )

    await tx.customerPayment.update({ where: { id: payment.id }, data: { journalId: journal.id } })

    for (const application of applications) {
      await assertInvoiceBelongsToCustomer(tx, ctx, application.invoiceId, customer.id)
      await tx.salesApplication.create({
        data: {
          orgId: ctx.orgId,
          paymentId: payment.id,
          invoiceId: application.invoiceId,
          amount: application.amount.toFixed(4),
        },
      })
      await refreshStatus(tx, application.invoiceId)
    }

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'CustomerPayment',
        entityId: payment.id,
        action: 'CREATE',
        after: {
          number: payment.number,
          amount: amount.toString(),
          applied: appliedTotal.toString(),
          invoices: applications.length,
        },
      },
      meta,
    )

    return { id: payment.id, number: payment.number }
  })
}

/**
 * Edit a recorded payment.
 *
 * Applications are replaced wholesale. If the amount or deposit account changes,
 * the journal is reversed and a new one posted (ADR-0002). A payment already on a
 * bank deposit cannot change those ledger fields until it is taken off the deposit.
 */
export async function update(ctx: OrgContext, id: string, input: PaymentInput) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const existing = await tx.customerPayment.findFirst({
      where: { id, orgId: ctx.orgId },
      select: {
        id: true,
        number: true,
        status: true,
        journalId: true,
        amount: true,
        date: true,
        depositAccountId: true,
        customerId: true,
        deletedAt: true,
        applications: { select: { id: true, invoiceId: true } },
      },
    })
    if (!existing || existing.deletedAt) throw notFound('Payment')
    if (existing.status === 'VOID') {
      throw precondition('A voided payment cannot be edited. Record a new one.')
    }

    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, orgId: ctx.orgId },
      select: { id: true, displayName: true, isActive: true },
    })
    if (!customer) throw notFound('Customer')

    const deposit = await tx.ledgerAccount.findFirst({
      where: { id: input.depositAccountId, orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true, subtype: true },
    })
    if (!deposit) throw notFound('Deposit account')
    if (deposit.subtype !== 'BANK' && deposit.subtype !== 'UNDEPOSITED_FUNDS') {
      throw validation(
        `"${deposit.name}" is not a bank or undeposited funds account, so money cannot be received into it.`,
        { depositAccountId: ['Choose a bank or undeposited funds account'] },
      )
    }

    const amount = new Decimal(input.amount)
    const applications = input.applications
      .map((application) => ({ ...application, amount: new Decimal(application.amount) }))
      .filter((application) => application.amount.greaterThan(0))

    const appliedTotal = applications.reduce((sum, a) => sum.plus(a.amount), ZERO)
    if (appliedTotal.greaterThan(amount)) {
      throw validation(
        `You are applying ${toMoneyString(appliedTotal, 2)} of a ${toMoneyString(amount, 2)} payment. ` +
          `Reduce the applied amounts, or increase the payment.`,
      )
    }

    const amountChanged = !amount.equals(existing.amount.toString())
    const depositChanged = deposit.id !== existing.depositAccountId
    const customerChanged = customer.id !== existing.customerId
    const dateChanged = toCalendarDate(existing.date) !== input.date
    const ledgerChanged = amountChanged || depositChanged || customerChanged || dateChanged

    if (ledgerChanged) {
      const bankedOn = await tx.depositLine.findFirst({
        where: { customerPaymentId: id },
        select: { depositId: true },
      })
      if (bankedOn) {
        throw precondition(
          `${existing.number} is already on a bank deposit. Remove it from the deposit before changing the amount, customer, date, or deposit account.`,
        )
      }
    }

    const previousInvoiceIds = existing.applications.map((application) => application.invoiceId)
    await tx.salesApplication.deleteMany({ where: { paymentId: id } })

    if (ledgerChanged && existing.journalId) {
      await reverseJournal(tx, ctx, existing.journalId, {
        reason: `${existing.number} edited`,
      })
    }

    const number = await assignDocumentNumber(tx, ctx.orgId, 'CUSTOMER_PAYMENT', input.number)
    const clash = await tx.customerPayment.findFirst({
      where: { orgId: ctx.orgId, number, id: { not: id } },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    let journalId = existing.journalId
    if (ledgerChanged) {
      const journal = await postJournal(
        tx,
        ctx,
        buildCustomerPaymentJournal({
          date: input.date,
          number,
          paymentId: id,
          customerId: customer.id,
          amount,
          depositAccountId: deposit.id,
          receivableAccountId: await systemAccountId(tx, ctx.orgId, 'ACCOUNTS_RECEIVABLE'),
          memo: input.memo,
        }),
      )
      journalId = journal.id
    }

    await tx.customerPayment.update({
      where: { id },
      data: {
        number,
        customerId: customer.id,
        date: toDate(input.date),
        amount: amount.toFixed(4),
        method: input.method,
        reference: input.reference ?? null,
        memo: input.memo ?? null,
        depositAccountId: deposit.id,
        journalId,
        status: 'OPEN',
      },
    })

    for (const application of applications) {
      await assertInvoiceBelongsToCustomer(tx, ctx, application.invoiceId, customer.id)
      await tx.salesApplication.create({
        data: {
          orgId: ctx.orgId,
          paymentId: id,
          invoiceId: application.invoiceId,
          amount: application.amount.toFixed(4),
        },
      })
      await refreshStatus(tx, application.invoiceId)
    }

    for (const invoiceId of new Set([...previousInvoiceIds, ...applications.map((a) => a.invoiceId)])) {
      await refreshStatus(tx, invoiceId)
    }

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'CustomerPayment',
        entityId: id,
        action: 'UPDATE',
        after: {
          number,
          amount: amount.toString(),
          applied: appliedTotal.toString(),
          invoices: applications.length,
        },
      },
      meta,
    )

    return { id, number }
  })
}

/**
 * Put a credit memo against one or more invoices.
 *
 * A credit is already in the ledger — the memo posted it. Applying it moves
 * nothing; it only records which receivable it settles, which is why there is no
 * journal here.
 */
export async function applyCredit(
  ctx: OrgContext,
  creditDocumentId: string,
  applications: { invoiceId: string; amount: string }[],
) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const credit = await tx.salesDocument.findFirst({
      where: { id: creditDocumentId, orgId: ctx.orgId, type: 'CREDIT_MEMO' },
      select: { id: true, number: true, status: true, customerId: true, total: true },
    })
    if (!credit) throw notFound('Credit memo')
    if (credit.status === 'VOID' || credit.status === 'DRAFT') {
      throw precondition(`${credit.number} is ${credit.status.toLowerCase()} and cannot be applied.`)
    }

    for (const application of applications) {
      const amount = new Decimal(application.amount)
      if (!amount.greaterThan(0)) continue

      await assertInvoiceBelongsToCustomer(tx, ctx, application.invoiceId, credit.customerId)

      await tx.salesApplication.create({
        data: {
          orgId: ctx.orgId,
          creditDocumentId: credit.id,
          invoiceId: application.invoiceId,
          amount: amount.toFixed(4),
        },
      })
      await refreshStatus(tx, application.invoiceId)
    }

    // A credit with nothing left in it is spent.
    const applied = await tx.salesApplication.aggregate({
      where: { creditDocumentId: credit.id },
      _sum: { amount: true },
    })
    const remaining = new Decimal(credit.total.toString()).minus(
      applied._sum.amount?.toString() ?? '0',
    )
    if (remaining.lessThanOrEqualTo(0)) {
      await tx.salesDocument.update({ where: { id: credit.id }, data: { status: 'CLOSED' } })
    }

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'SalesDocument',
        entityId: credit.id,
        action: 'UPDATE',
        after: { appliedTo: applications.length, remaining: remaining.toString() },
      },
      meta,
    )

    return { id: credit.id, number: credit.number }
  })
}

/** Undo an application, putting the money back where it came from. */
export async function unapply(ctx: OrgContext, applicationId: string) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const application = await tx.salesApplication.findFirst({
      where: { id: applicationId, orgId: ctx.orgId },
      select: { id: true, invoiceId: true, amount: true, creditDocumentId: true },
    })
    if (!application) throw notFound('Application')

    await tx.salesApplication.delete({ where: { id: applicationId } })
    await refreshStatus(tx, application.invoiceId)

    if (application.creditDocumentId) {
      await tx.salesDocument.update({
        where: { id: application.creditDocumentId },
        data: { status: 'OPEN' },
      })
    }

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'SalesApplication',
        entityId: applicationId,
        action: 'DELETE',
        before: { invoiceId: application.invoiceId, amount: application.amount.toString() },
      },
      meta,
    )

    return { id: applicationId }
  })
}

/**
 * Delete a payment: withdraw its journal, release everything it settled.
 *
 * The invoices it was paying go back to outstanding, which is what they are once
 * the payment is gone. Nothing is physically removed — see
 * `server/accounting/deletion.ts`.
 */
export async function remove(ctx: OrgContext, id: string, reason?: string | null) {
  return db.$transaction(async (tx) => {
    const payment = await tx.customerPayment.findFirst({
      where: { id, orgId: ctx.orgId, deletedAt: undefined },
      select: {
        id: true, number: true, status: true, journalId: true, amount: true, deletedAt: true,
        applications: { select: { id: true, invoiceId: true } },
      },
    })
    if (!payment) throw notFound('Payment')
    if (payment.deletedAt) return { id, number: payment.number }

    const invoiceIds = payment.applications.map((application) => application.invoiceId)
    await tx.salesApplication.deleteMany({ where: { paymentId: id } })

    // A payment already banked on a deposit takes the deposit with it.
    //
    // A deposit is one posted movement of one total from Undeposited Funds to the
    // bank. There is no honest way to remove one payment from that total and
    // leave the rest posted, so the whole deposit is withdrawn and the payments
    // it banked go back to the undeposited list — which is exactly where they
    // stand once one of them turns out not to exist. Deleting the deposit is
    // done through banking's own service so the reconciliation guard applies.
    const bankedOn = await tx.depositLine.findMany({
      where: { customerPaymentId: id },
      select: { depositId: true },
    })

    for (const depositId of new Set(bankedOn.map((line) => line.depositId))) {
      await removeDepositWithin(tx, ctx, depositId, `Banked ${payment.number}, which was deleted`)
    }

    await softDeleteDocument(tx, ctx, {
      mark: (stamp) => tx.customerPayment.update({ where: { id }, data: stamp }),
      entity: 'CustomerPayment',
      id,
      number: payment.number,
      journalIds: [payment.journalId],
      reason,
      before: {
        amount: payment.amount.toString(),
        status: payment.status,
        applicationsReleased: payment.applications.length,
      },
    })

    for (const invoiceId of invoiceIds) await refreshStatus(tx, invoiceId)

    return { id, number: payment.number }
  })
}

async function assertInvoiceBelongsToCustomer(
  tx: Tx,
  ctx: OrgContext,
  invoiceId: string,
  customerId: string,
) {
  const invoice = await tx.salesDocument.findFirst({
    where: { id: invoiceId, orgId: ctx.orgId, type: 'INVOICE' },
    select: { id: true, number: true, customerId: true, status: true },
  })
  if (!invoice) throw notFound('Invoice')

  if (invoice.customerId !== customerId) {
    throw validation(
      `Invoice ${invoice.number} belongs to a different customer. ` +
        `Settling one customer's invoice with another's money puts both subledgers wrong.`,
    )
  }
}

export { toCalendarDate }
