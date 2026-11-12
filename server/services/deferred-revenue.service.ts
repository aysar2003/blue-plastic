import 'server-only'

import { addMonths, today, toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import { recognitionSlice, remainingUnearned } from '@/lib/erp/deferred-revenue'
import type { ManualJournalInput } from '@/lib/validation/accounting'
import { seedChartOfAccounts, systemAccountId } from '@/server/accounting/chart-of-accounts'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import * as journalService from '@/server/services/journal.service'

/**
 * After a subscription invoice posts to income, move net into Unearned Revenue
 * and open a recognition schedule.
 */
export async function deferPostedInvoice(
  ctx: OrgContext,
  input: {
    salesDocumentId: string
    recurringTemplateId?: string | null
    serviceMonths: number
    runOn: CalendarDate
  },
) {
  const months = Math.floor(input.serviceMonths)
  if (months < 1 || months > 60) {
    throw validation('Service months must be between 1 and 60.')
  }

  const doc = await db.salesDocument.findFirst({
    where: {
      id: input.salesDocumentId,
      orgId: ctx.orgId,
      type: 'INVOICE',
      deletedAt: null,
    },
    select: {
      id: true,
      number: true,
      total: true,
      status: true,
      lines: { select: { amount: true, incomeAccountId: true } },
    },
  })
  if (!doc) throw notFound('Invoice')
  if (doc.status === 'DRAFT') {
    throw precondition('Post the invoice before deferring revenue.')
  }

  const existing = await db.deferredRevenueSchedule.findFirst({
    where: { orgId: ctx.orgId, salesDocumentId: doc.id },
    select: { id: true },
  })
  if (existing) return existing

  const net = doc.lines.reduce(
    (sum, line) => sum.plus(new Decimal(line.amount.toString())),
    ZERO,
  )
  if (net.lessThanOrEqualTo(0)) {
    throw validation('Nothing to defer on this invoice.')
  }

  await db.$transaction(async (tx) => {
    await seedChartOfAccounts(tx, ctx.orgId)
  })

  const incomeAccountId =
    doc.lines.find((line) => line.incomeAccountId)?.incomeAccountId ??
    (await db.$transaction((tx) => systemAccountId(tx, ctx.orgId, 'UNCATEGORISED_INCOME')))
  const unearnedAccountId = await db.$transaction((tx) =>
    systemAccountId(tx, ctx.orgId, 'UNEARNED_REVENUE'),
  )

  const journalInput: ManualJournalInput = {
    date: input.runOn,
    number: undefined,
    memo: `[DEFERRAL] Invoice ${doc.number} — move to unearned`,
    isAdjusting: true,
    autoReverse: false,
    lines: [
      {
        accountId: incomeAccountId,
        debit: net.toFixed(4),
        credit: '0',
        description: `Defer revenue · ${doc.number}`,
      },
      {
        accountId: unearnedAccountId,
        debit: '0',
        credit: net.toFixed(4),
        description: `Unearned · ${doc.number}`,
      },
    ],
  }
  const journal = await journalService.createManual(ctx, journalInput)
  const nextRecognizeOn = addMonths(input.runOn, 1)

  return db.deferredRevenueSchedule.create({
    data: {
      orgId: ctx.orgId,
      recurringTemplateId: input.recurringTemplateId ?? null,
      salesDocumentId: doc.id,
      totalAmount: net,
      recognizedAmount: 0,
      serviceMonths: months,
      serviceStartOn: toDate(input.runOn),
      nextRecognizeOn: toDate(nextRecognizeOn),
      deferralJournalId: journal.id,
    },
  })
}

export async function listOpenSchedules(ctx: OrgContext) {
  if (!ctx.permissions.has('report:read') && !ctx.permissions.has('invoice:read')) {
    return []
  }
  const rows = await db.deferredRevenueSchedule.findMany({
    where: { orgId: ctx.orgId, isComplete: false },
    orderBy: { nextRecognizeOn: 'asc' },
    take: 200,
  })
  return rows.map((row) => ({
    id: row.id,
    salesDocumentId: row.salesDocumentId,
    totalAmount: row.totalAmount.toFixed(4),
    recognizedAmount: row.recognizedAmount.toFixed(4),
    remaining: remainingUnearned(row.totalAmount, row.recognizedAmount).toFixed(4),
    serviceMonths: row.serviceMonths,
    nextRecognizeOn: toCalendarDate(row.nextRecognizeOn),
  }))
}

/** Recognize one month for every schedule due on or before asOf. */
export async function recognizeDue(ctx: OrgContext, asOfInput?: CalendarDate) {
  const asOf = asOfInput ?? today(ctx.organization.timeZone)
  const due = await db.deferredRevenueSchedule.findMany({
    where: {
      orgId: ctx.orgId,
      isComplete: false,
      nextRecognizeOn: { lte: toDate(asOf) },
    },
    orderBy: { nextRecognizeOn: 'asc' },
    take: 200,
  })

  const created: { scheduleId: string; amount: string; journalId: string }[] = []
  const skipped: { id: string; message: string }[] = []

  for (const row of due) {
    try {
      const monthIndex = Math.round(
        new Decimal(row.recognizedAmount.toString())
          .div(new Decimal(row.totalAmount.toString()).div(row.serviceMonths).toDecimalPlaces(4))
          .toNumber(),
      )
      const slice = recognitionSlice(
        row.totalAmount,
        row.serviceMonths,
        Number.isFinite(monthIndex) ? monthIndex : 0,
        row.recognizedAmount,
      )
      if (slice.isZero()) {
        await db.deferredRevenueSchedule.update({
          where: { id: row.id },
          data: { isComplete: true },
        })
        continue
      }

      await db.$transaction(async (tx) => {
        await seedChartOfAccounts(tx, ctx.orgId)
      })
      const unearnedAccountId = await db.$transaction((tx) =>
        systemAccountId(tx, ctx.orgId, 'UNEARNED_REVENUE'),
      )
      const incomeAccountId = await db.$transaction((tx) =>
        systemAccountId(tx, ctx.orgId, 'UNCATEGORISED_INCOME'),
      )

      const journal = await journalService.createManual(ctx, {
        date: asOf,
        number: undefined,
        memo: `[RECOGNIZE] Deferred revenue schedule`,
        isAdjusting: true,
        autoReverse: false,
        lines: [
          {
            accountId: unearnedAccountId,
            debit: slice.toFixed(4),
            credit: '0',
            description: 'Recognize deferred revenue',
          },
          {
            accountId: incomeAccountId,
            debit: '0',
            credit: slice.toFixed(4),
            description: 'Earned subscription / rental revenue',
          },
        ],
      })

      const nextRecognized = new Decimal(row.recognizedAmount.toString()).plus(slice)
      const complete = nextRecognized.greaterThanOrEqualTo(new Decimal(row.totalAmount.toString()))
      const nextDate = addMonths(toCalendarDate(row.nextRecognizeOn), 1)

      await db.deferredRevenueSchedule.update({
        where: { id: row.id },
        data: {
          recognizedAmount: nextRecognized,
          lastRecognitionJournalId: journal.id,
          nextRecognizeOn: toDate(nextDate),
          isComplete: complete,
        },
      })

      created.push({
        scheduleId: row.id,
        amount: slice.toFixed(4),
        journalId: journal.id,
      })
    } catch (error) {
      skipped.push({
        id: row.id,
        message: error instanceof Error ? error.message : 'Could not recognize.',
      })
    }
  }

  return { created, skipped, asOf, dueCount: due.length }
}
