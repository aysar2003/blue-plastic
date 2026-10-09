import 'server-only'
import type { Prisma } from '@prisma/client'

import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { DepositInput, TransferInput } from '@/lib/validation/banking'
import { buildDepositJournal, buildTransferJournal } from '@/server/accounting/builders/banking'
import { systemAccountId } from '@/server/accounting/chart-of-accounts'
import { softDeleteDocument } from '@/server/accounting/deletion'
import { postJournal } from '@/server/accounting/posting'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'
import { assignDocumentNumber, numberTaken } from '@/server/sequences'

/** Accounts a bank register can be opened on. */
export async function bankAccounts(ctx: OrgContext) {
  const accounts = await db.ledgerAccount.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      subtype: { in: ['BANK', 'CREDIT_CARD', 'UNDEPOSITED_FUNDS'] },
    },
    select: { id: true, code: true, name: true, subtype: true, type: true },
    orderBy: { code: 'asc' },
  })

  const balances = await db.$queryRaw<{ accountId: string; balance: string; cleared: string }[]>`
    SELECT l."accountId" AS "accountId",
           COALESCE(SUM(l.debit - l.credit), 0) AS balance,
           COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.debit - l.credit ELSE 0 END), 0) AS cleared
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
      LEFT JOIN reconciliation_entries e ON e."journalLineId" = l.id
     WHERE l."orgId" = ${ctx.orgId}
       AND l."accountId" = ANY(${accounts.map((a) => a.id)})
     GROUP BY l."accountId"
  `

  const byId = new Map(balances.map((row) => [row.accountId, row]))

  return accounts.map((account) => {
    const row = byId.get(account.id)
    const balance = new Decimal(row?.balance ?? '0')
    const cleared = new Decimal(row?.cleared ?? '0')
    return {
      ...account,
      // A credit card is a liability: showing it as a negative asset helps nobody.
      balance: account.type === 'LIABILITY' ? balance.negated() : balance,
      cleared: account.type === 'LIABILITY' ? cleared.negated() : cleared,
      uncleared: balance.minus(cleared).abs(),
    }
  })
}

/* --- Transfers ------------------------------------------------------------ */

export async function listTransfers(ctx: OrgContext, query: ListQuery) {
  const where: Prisma.BankTransferWhereInput = {
    orgId: ctx.orgId,
    ...(query.q
      ? {
          OR: [
            { number: { contains: query.q, mode: 'insensitive' } },
            { memo: { contains: query.q, mode: 'insensitive' } },
            { reference: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.bankTransfer.findMany({
      where,
      select: {
        id: true, number: true, date: true, createdAt: true, amount: true, memo: true, reference: true, status: true,
        journalId: true,
        fromAccount: { select: { id: true, code: true, name: true } },
        toAccount: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      ...paginate(query),
    }),
    db.bankTransfer.count({ where }),
  ])

  return paged(rows.map((row) => ({ ...row, amount: row.amount.toString() })), total, query)
}

export async function createTransfer(ctx: OrgContext, input: TransferInput) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const [from, to] = await Promise.all([
      requireMoneyAccount(tx, ctx, input.fromAccountId),
      requireMoneyAccount(tx, ctx, input.toAccountId),
    ])

    const number = await assignDocumentNumber(tx, ctx.orgId, 'TRANSFER', input.number)
    const transferClash = await tx.bankTransfer.findFirst({
      where: { orgId: ctx.orgId, number },
      select: { id: true },
    })
    if (transferClash) throw numberTaken()
    const amount = new Decimal(input.amount)

    const transfer = await tx.bankTransfer.create({
      data: {
        orgId: ctx.orgId,
        number,
        date: toDate(input.date),
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: amount.toFixed(4),
        memo: input.memo ?? null,
        reference: input.reference ?? null,
        currencyCode: ctx.organization.baseCurrency,
        createdById: ctx.userId,
      },
      select: { id: true, number: true },
    })

    const journal = await postJournal(
      tx,
      ctx,
      buildTransferJournal({
        date: input.date,
        number: transfer.number,
        transferId: transfer.id,
        fromAccountId: from.id,
        toAccountId: to.id,
        amount,
        memo: input.memo,
      }),
    )

    await tx.bankTransfer.update({ where: { id: transfer.id }, data: { journalId: journal.id } })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'BankTransfer',
        entityId: transfer.id,
        action: 'CREATE',
        after: { number: transfer.number, amount: amount.toString(), from: from.name, to: to.name },
      },
      meta,
    )

    return { id: transfer.id, number: transfer.number }
  })
}

/* --- Deposits ------------------------------------------------------------- */

/** Customer payments sitting in Undeposited Funds, waiting to be banked. */
export async function undepositedPayments(ctx: OrgContext) {
  const undeposited = await systemAccountId(db as unknown as Tx, ctx.orgId, 'UNDEPOSITED_FUNDS')

  const payments = await db.customerPayment.findMany({
    where: {
      orgId: ctx.orgId,
      depositAccountId: undeposited,
      status: { not: 'VOID' },
      // A payment already on a paying-in slip is not waiting for one.
      depositLines: { none: {} },
    },
    select: {
      id: true, number: true, date: true, amount: true, method: true, reference: true,
      customer: { select: { displayName: true } },
    },
    orderBy: { date: 'asc' },
  })

  return payments.map((payment) => ({ ...payment, amount: payment.amount.toString() }))
}

export async function listDeposits(ctx: OrgContext, query: ListQuery) {
  const where: Prisma.DepositWhereInput = {
    orgId: ctx.orgId,
    ...(query.q ? { OR: [{ number: { contains: query.q, mode: 'insensitive' } }, { memo: { contains: query.q, mode: 'insensitive' } }] } : {}),
  }

  const [rows, total] = await Promise.all([
    db.deposit.findMany({
      where,
      select: {
        id: true, number: true, date: true, createdAt: true, total: true, memo: true, status: true,
        journalId: true,
        bankAccount: { select: { id: true, code: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      ...paginate(query),
    }),
    db.deposit.count({ where }),
  ])

  return paged(rows.map((row) => ({ ...row, total: row.total.toString() })), total, query)
}

export async function createDeposit(ctx: OrgContext, input: DepositInput) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const bank = await requireMoneyAccount(tx, ctx, input.bankAccountId)
    const undeposited = await systemAccountId(tx, ctx.orgId, 'UNDEPOSITED_FUNDS')

    const payments = input.paymentIds.length
      ? await tx.customerPayment.findMany({
          where: { id: { in: input.paymentIds }, orgId: ctx.orgId },
          select: {
            id: true, number: true, amount: true, depositAccountId: true, status: true,
            depositLines: { select: { id: true } },
          },
        })
      : []

    if (payments.length !== input.paymentIds.length) throw notFound('Payment')

    for (const payment of payments) {
      if (payment.status === 'VOID') {
        throw precondition(`Payment ${payment.number} is void and cannot be banked.`)
      }
      if (payment.depositAccountId !== undeposited) {
        throw validation(
          `Payment ${payment.number} went straight to a bank account, so there is nothing to deposit.`,
        )
      }
      if (payment.depositLines.length > 0) {
        throw conflict(`Payment ${payment.number} is already on a paying-in slip.`)
      }
    }

    const paymentTotal = payments.reduce((sum, p) => sum.plus(p.amount.toString()), ZERO)
    const otherTotal = input.otherLines.reduce((sum, line) => sum.plus(line.amount), ZERO)
    const total = paymentTotal.plus(otherTotal)

    if (total.isZero()) {
      throw validation('A deposit with nothing on it has nothing to record.')
    }

    const number = await assignDocumentNumber(tx, ctx.orgId, 'DEPOSIT', input.number)
    const depositClash = await tx.deposit.findFirst({
      where: { orgId: ctx.orgId, number },
      select: { id: true },
    })
    if (depositClash) throw numberTaken()
    let lineNumber = 0

    const deposit = await tx.deposit.create({
      data: {
        orgId: ctx.orgId,
        number,
        date: toDate(input.date),
        bankAccountId: bank.id,
        total: total.toFixed(4),
        memo: input.memo ?? null,
        reference: input.reference ?? null,
        currencyCode: ctx.organization.baseCurrency,
        createdById: ctx.userId,
        lines: {
          create: [
            ...payments.map((payment) => ({
              orgId: ctx.orgId,
              lineNumber: ++lineNumber,
              customerPaymentId: payment.id,
              description: `Payment ${payment.number}`,
              amount: payment.amount.toString(),
            })),
            ...input.otherLines.map((line) => ({
              orgId: ctx.orgId,
              lineNumber: ++lineNumber,
              accountId: line.accountId,
              description: line.description ?? null,
              amount: line.amount,
            })),
          ],
        },
      },
      select: { id: true, number: true },
    })

    const journal = await postJournal(
      tx,
      ctx,
      buildDepositJournal({
        date: input.date,
        number: deposit.number,
        depositId: deposit.id,
        bankAccountId: bank.id,
        memo: input.memo,
        lines: [
          // Everything banked out of Undeposited Funds clears that account.
          ...(paymentTotal.isZero()
            ? []
            : [{ accountId: undeposited, amount: paymentTotal, description: 'Payments banked' }]),
          ...input.otherLines.map((line) => ({
            accountId: line.accountId,
            amount: line.amount,
            description: line.description ?? null,
          })),
        ],
      }),
    )

    await tx.deposit.update({ where: { id: deposit.id }, data: { journalId: journal.id } })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Deposit',
        entityId: deposit.id,
        action: 'CREATE',
        after: { number: deposit.number, total: total.toString(), payments: payments.length },
      },
      meta,
    )

    return { id: deposit.id, number: deposit.number }
  })
}

/* --- Deleting ------------------------------------------------------------- */

export async function removeTransfer(ctx: OrgContext, id: string, reason?: string | null) {
  return removeBankDocument(ctx, 'BankTransfer', id, reason)
}

export async function removeDeposit(ctx: OrgContext, id: string, reason?: string | null) {
  return removeBankDocument(ctx, 'Deposit', id, reason)
}

/**
 * Delete a deposit inside somebody else's transaction.
 *
 * Deleting a customer payment that has already been banked has to take the
 * deposit with it, and the two have to succeed or fail together.
 */
export async function removeDepositWithin(
  tx: Tx,
  ctx: OrgContext,
  id: string,
  reason?: string | null,
) {
  return removeBankDocumentWithin(tx, ctx, 'Deposit', id, reason)
}

/**
 * Delete a transfer or a deposit.
 *
 * The one thing that genuinely cannot be waved through is a reconciled item: it
 * has been agreed with the bank, and removing it silently would put a finished
 * reconciliation out by exactly this amount. That is not an alternative workflow
 * being offered instead of deleting — it is a different record standing in the
 * way, and the message says which one and what to do about it.
 *
 * Deleting a deposit releases the payments it banked. They go back to the
 * undeposited list, which is where they were and where they belong.
 */
async function removeBankDocument(
  ctx: OrgContext,
  entity: 'BankTransfer' | 'Deposit',
  id: string,
  reason?: string | null,
) {
  return db.$transaction((tx) => removeBankDocumentWithin(tx, ctx, entity, id, reason))
}

async function removeBankDocumentWithin(
  tx: Tx,
  ctx: OrgContext,
  entity: 'BankTransfer' | 'Deposit',
  id: string,
  reason?: string | null,
) {
  {
    const document =
      entity === 'BankTransfer'
        ? await tx.bankTransfer.findFirst({
            where: { id, orgId: ctx.orgId, deletedAt: undefined },
            select: { id: true, number: true, status: true, journalId: true, deletedAt: true },
          })
        : await tx.deposit.findFirst({
            where: { id, orgId: ctx.orgId, deletedAt: undefined },
            select: { id: true, number: true, status: true, journalId: true, deletedAt: true },
          })

    if (!document) throw notFound(entity === 'BankTransfer' ? 'Transfer' : 'Deposit')
    if (document.deletedAt) return { id, number: document.number }

    if (document.journalId) {
      const cleared = await tx.reconciliationEntry.count({
        where: { journalLine: { journalId: document.journalId } },
      })
      if (cleared > 0) {
        throw precondition(
          `${document.number} has been reconciled with the bank. Undo that reconciliation first, ` +
            `then delete it — otherwise the reconciliation would silently be out by this amount.`,
        )
      }
    }

    if (entity === 'Deposit') {
      // Releasing the lines puts the payments back in the undeposited list.
      await tx.depositLine.deleteMany({ where: { depositId: id } })
    }

    return softDeleteDocument(tx, ctx, {
      mark: (stamp) =>
        entity === 'BankTransfer'
          ? tx.bankTransfer.update({ where: { id }, data: stamp })
          : tx.deposit.update({ where: { id }, data: stamp }),
      entity,
      id,
      number: document.number,
      journalIds: [document.journalId],
      reason,
      before: { status: document.status },
    })
  }
}

/**
 * Which accounts a transfer or a deposit may touch.
 *
 * Any account the business holds money in — not just the three subtypes the
 * chart happens to call BANK, CREDIT_CARD and UNDEPOSITED_FUNDS. Petty cash kept
 * in an "Other current asset", a director's loan repaid out of the bank, a
 * mobile-money float: all of these are real, and a form that refuses them forces
 * the entry to be made as a journal instead, where nothing checks it.
 *
 * What is still refused is income, expense and equity. Moving money to "Sales"
 * is not a transfer — it is a sale, and recording it as a transfer would leave
 * the profit and loss wrong. So the rule is stated by *statement type*, which is
 * the thing that actually matters, rather than by a list of subtype names.
 */
async function requireMoneyAccount(tx: Tx, ctx: OrgContext, accountId: string) {
  const account = await tx.ledgerAccount.findFirst({
    where: { id: accountId, orgId: ctx.orgId, isActive: true },
    select: { id: true, name: true, code: true, subtype: true, type: true },
  })
  if (!account) throw notFound('Account')

  if (account.type !== 'ASSET' && account.type !== 'LIABILITY') {
    throw validation(
      `"${account.name}" is an ${account.type.toLowerCase()} account. Money cannot be transferred into or out of one — ` +
        `that would be income or a cost, not a movement between the business's own accounts.`,
    )
  }

  return account
}

export { toCalendarDate, type CalendarDate }
