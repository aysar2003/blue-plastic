import 'server-only'

import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { Decimal, money } from '@/lib/money'
import { deleteJournals, restoreJournals } from '@/server/accounting/deletion'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import * as standardPayroll from '@/server/services/payroll-standard.service'

function runLabel(row: { periodStart: Date; periodEnd: Date }) {
  return `Payroll ${toCalendarDate(row.periodStart)} – ${toCalendarDate(row.periodEnd)}`
}

export async function listRuns(ctx: OrgContext) {
  const rows = await db.payrollRun.findMany({
    where: { orgId: ctx.orgId },
    include: {
      _count: { select: { payslips: true } },
      journal: { select: { id: true, journalNumber: true } },
    },
    orderBy: [{ periodStart: 'desc' }],
    take: 100,
  })
  return rows.map((row) => ({
    id: row.id,
    periodStart: toCalendarDate(row.periodStart),
    periodEnd: toCalendarDate(row.periodEnd),
    memo: row.memo,
    status: row.status,
    payslipCount: row._count.payslips,
    journalNumber: row.journal?.journalNumber ?? null,
    journalId: row.journalId,
    postedAt: row.postedAt,
    payMode: row.payMode,
    awaitingApproval: row.awaitingApproval,
  }))
}

export async function getRun(ctx: OrgContext, id: string) {
  const row = await db.payrollRun.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      journal: { select: { id: true, journalNumber: true } },
      settlementJournal: { select: { id: true, journalNumber: true } },
      payslips: {
        include: {
          employee: {
            select: { id: true, name: true, department: true, payMethod: true, payAccountId: true },
          },
          lines: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { employee: { name: 'asc' } },
      },
    },
  })
  if (!row) throw notFound('Payroll run')
  const year = toCalendarDate(row.periodEnd).slice(0, 4)
  const ytdRows = await db.payslip.findMany({
    where: {
      orgId: ctx.orgId,
      employeeId: { in: row.payslips.map((slip) => slip.employeeId) },
      included: true,
      run: {
        status: 'POSTED',
        periodEnd: { gte: toDate(`${year}-01-01`), lte: toDate(`${year}-12-31`) },
      },
    },
    select: { employeeId: true, gross: true, net: true },
  })
  const ytd = new Map<string, { gross: Decimal; net: Decimal }>()
  for (const slip of ytdRows) {
    const current = ytd.get(slip.employeeId) ?? { gross: money(0), net: money(0) }
    current.gross = current.gross.plus(slip.gross)
    current.net = current.net.plus(slip.net)
    ytd.set(slip.employeeId, current)
  }
  const payslips = row.payslips.map((slip) => ({
    id: slip.id,
    number: slip.number,
    included: slip.included,
    employeeId: slip.employeeId,
    employeeName: slip.employee.name,
    department: slip.employee.department,
    payMethod: slip.employee.payMethod,
    payAccountId: slip.employee.payAccountId,
    workedDaysOverride: slip.workedDaysOverride,
    workedHoursOverride: slip.workedHoursOverride?.toFixed(4) ?? null,
    overtimeAmountOverride: slip.overtimeAmountOverride?.toFixed(4) ?? null,
    gross: slip.gross.toFixed(4),
    deductions: slip.deductions.toFixed(4),
    employer: slip.employer.toFixed(4),
    net: slip.net.toFixed(4),
    ytdGross: (ytd.get(slip.employeeId)?.gross ?? money(0)).toFixed(2),
    ytdNet: (ytd.get(slip.employeeId)?.net ?? money(0)).toFixed(2),
    lines: slip.lines.map((line) => ({
      id: line.id,
      code: line.code,
      label: line.label,
      amount: line.amount.toFixed(4),
      kind: line.kind,
      affectsNet: line.affectsNet,
    })),
  }))
  return {
    id: row.id,
    periodStart: toCalendarDate(row.periodStart),
    periodEnd: toCalendarDate(row.periodEnd),
    memo: row.memo,
    status: row.status,
    payFromAccountId: row.payFromAccountId,
    liabilityAccountId: row.liabilityAccountId,
    payMode: row.payMode,
    awaitingApproval: row.awaitingApproval,
    journalId: row.journalId,
    journalNumber: row.journal?.journalNumber ?? null,
    settlementJournalId: row.settlementJournalId,
    settlementJournalNumber: row.settlementJournal?.journalNumber ?? null,
    paidAt: row.paidAt,
    postedAt: row.postedAt,
    paymentSummary: standardPayroll.summarizePayMethods(
      payslips.map((slip) => ({
        payMethod: slip.payMethod as 'CASH' | 'BANK' | 'MOBILE',
        net: slip.net,
        included: slip.included,
      })),
    ),
    payslips,
  }
}

export async function createRun(
  ctx: OrgContext,
  input: {
    periodStart: CalendarDate
    periodEnd: CalendarDate
    memo?: string | null
    payFromAccountId?: string | null
    liabilityAccountId?: string | null
    payMode?: 'IMMEDIATE' | 'ACCRUE' | null
    employeeIds?: string[] | null
  },
) {
  const created = await standardPayroll.standardCreate(ctx, input)
  const run = await getRun(ctx, created.id)
  return { ...run, warnings: created.warnings }
}

/**
 * Delete a payroll run.
 *
 * Draft: remove the run (and payslips) outright — nothing hit the ledger.
 * Posted: withdraw the journal from balances and return the run to draft so it
 * can be fixed and posted again. Same path when Delete is clicked on the
 * journal (OWNED_BY.PAYROLL). The withdrawn journal keeps its idempotency key
 * (deleted rows are immutable); postRun mints a new key when that key is still
 * held by a DELETED journal.
 */
export async function remove(ctx: OrgContext, id: string, reason?: string | null) {
  const row = await db.payrollRun.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!row) throw notFound('Payroll run')
  const number = runLabel(row)

  if (row.status === 'DRAFT') {
    await db.payrollRun.delete({ where: { id } })
    return { id, number }
  }

  return db.$transaction(async (tx) => {
    const journalId = row.journalId
    const settlementJournalId = row.settlementJournalId
    // Detach first so the run is not left claiming a withdrawn journal.
    await tx.payrollRun.update({
      where: { id },
      data: {
        status: 'DRAFT',
        journalId: null,
        settlementJournalId: null,
        postedAt: null,
        paidAt: null,
        awaitingApproval: false,
      },
    })
    if (settlementJournalId) {
      await deleteJournals(tx, ctx, [settlementJournalId], reason, { audit: false })
    }
    if (journalId) {
      // Soft-delete only — posted/deleted journals are immutable, so the
      // idempotency key stays on the withdrawn row. postRun picks a fresh key
      // when that key is still held by a DELETED journal.
      await deleteJournals(tx, ctx, [journalId], reason, { audit: false })
    }
    await standardPayroll.restoreAdvanceRecoveries(tx, ctx.orgId, id)
    const meta = await requestMeta()
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'PayrollRun',
        entityId: id,
        action: 'DELETE',
        before: { status: 'POSTED', journalId, number },
        after: { status: 'DRAFT', reason: reason?.trim() || null },
      },
      meta,
    )
    return { id, number }
  })
}

/** @deprecated Prefer `remove` — kept for older payroll board call sites. */
export async function removeRun(ctx: OrgContext, id: string) {
  return remove(ctx, id)
}

/** Withdraw only the settlement payment journal (ACCRUE pay-later). */
export async function unsettle(ctx: OrgContext, id: string, reason?: string | null) {
  const row = await db.payrollRun.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!row) throw notFound('Payroll run')
  const number = runLabel(row)
  if (!row.settlementJournalId) {
    throw precondition('This payroll has no settlement payment to withdraw.')
  }
  return db.$transaction(async (tx) => {
    const settlementJournalId = row.settlementJournalId!
    await tx.payrollRun.update({
      where: { id },
      data: { settlementJournalId: null, paidAt: null },
    })
    await deleteJournals(tx, ctx, [settlementJournalId], reason, { audit: false })
    const meta = await requestMeta()
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'PayrollRun',
        entityId: id,
        action: 'UPDATE',
        before: { settlementJournalId, paidAt: row.paidAt },
        after: { settlementJournalId: null, reason: reason?.trim() || null },
      },
      meta,
    )
    return { id, number }
  })
}

export async function restoreSettlement(ctx: OrgContext, id: string) {
  const row = await db.payrollRun.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!row) throw notFound('Payroll run')
  const number = runLabel(row)
  const href = `/employees/payroll/${id}`
  if (row.settlementJournalId) return { id, number, href }

  const journal = await db.journal.findFirst({
    where: {
      orgId: ctx.orgId,
      sourceType: 'PAYROLL_SETTLEMENT',
      sourceId: id,
      status: 'DELETED',
    },
    orderBy: { deletedAt: 'desc' },
    select: { id: true, postedAt: true },
  })
  if (!journal) {
    throw precondition('No deleted settlement journal to restore for this run.')
  }
  return db.$transaction(async (tx) => {
    await restoreJournals(tx, ctx, [journal.id], { audit: false })
    await tx.payrollRun.update({
      where: { id },
      data: {
        settlementJournalId: journal.id,
        paidAt: journal.postedAt ?? new Date(),
      },
    })
    return { id, number, href }
  })
}

/**
 * Put a deleted payroll journal back and re-link the run as posted.
 * Used when Trash restores the journal (RESTORED_BY.PAYROLL).
 */
export async function restore(ctx: OrgContext, id: string) {
  const row = await db.payrollRun.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!row) throw notFound('Payroll run')
  const number = runLabel(row)
  const href = `/employees/payroll/${id}`

  if (row.status === 'POSTED' && row.journalId) {
    return { id, number, href }
  }

  const journal = await db.journal.findFirst({
    where: {
      orgId: ctx.orgId,
      sourceType: 'PAYROLL',
      sourceId: id,
      status: 'DELETED',
    },
    orderBy: { deletedAt: 'desc' },
    select: { id: true, postedAt: true },
  })
  if (!journal) {
    throw precondition('No deleted payroll journal to restore for this run.')
  }

  return db.$transaction(async (tx) => {
    // Restore keeps every column byte-identical (immutability trigger), including
    // the original idempotency key — do not try to rewrite it after restore.
    await restoreJournals(tx, ctx, [journal.id], { audit: false })
    await tx.payrollRun.update({
      where: { id },
      data: {
        status: 'POSTED',
        journalId: journal.id,
        postedAt: journal.postedAt ?? new Date(),
      },
    })
    const meta = await requestMeta()
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'PayrollRun',
        entityId: id,
        action: 'RESTORE',
        before: { status: 'DRAFT' },
        after: { status: 'POSTED', journalId: journal.id },
      },
      meta,
    )
    return { id, number, href }
  })
}

async function requireDraftPayslip(ctx: OrgContext, payslipId: string) {
  const slip = await db.payslip.findFirst({
    where: { id: payslipId, orgId: ctx.orgId },
    include: {
      run: { select: { id: true, status: true } },
      lines: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!slip) throw notFound('Payslip')
  if (slip.run.status !== 'DRAFT') {
    throw precondition('Only a draft payroll can be adjusted. Delete the posted run to withdraw the journal first.')
  }
  return slip
}

async function recalcPayslip(tx: Tx, payslipId: string) {
  const lines = await tx.payslipLine.findMany({
    where: { payslipId },
    orderBy: { sortOrder: 'asc' },
  })
  const earnings = lines
    .filter((line) => line.kind === 'EARNING')
    .reduce((sum, line) => sum.plus(line.amount), money(0))
  const deductions = lines
    .filter((line) => line.kind === 'DEDUCTION')
    .reduce((sum, line) => sum.plus(line.amount), money(0))
  const net = Decimal.max(earnings.minus(deductions), money(0))
  await tx.payslip.update({
    where: { id: payslipId },
    data: { gross: earnings, deductions, net },
  })
  return { gross: earnings, deductions, net }
}

/** Add a bonus (earning) or deduction on a draft payslip. */
export async function addPayslipAdjustment(
  ctx: OrgContext,
  input: {
    payslipId: string
    kind: 'EARNING' | 'DEDUCTION'
    label: string
    amount: string
  },
) {
  const amount = money(input.amount)
  if (amount.lte(0)) {
    throw validation('Amount must be greater than zero.', { amount: ['Must be greater than zero'] })
  }

  const slip = await requireDraftPayslip(ctx, input.payslipId)
  const sortOrder = (slip.lines.at(-1)?.sortOrder ?? -1) + 1
  const code = input.kind === 'EARNING' ? 'BONUS' : 'DEDUCTION'
  const label =
    input.label.trim() || (input.kind === 'EARNING' ? 'Bonus' : 'Deduction')

  await db.$transaction(async (tx) => {
    await tx.payslipLine.create({
      data: {
        orgId: ctx.orgId,
        payslipId: slip.id,
        code,
        label,
        amount,
        kind: input.kind,
        sortOrder,
      },
    })
    await recalcPayslip(tx, slip.id)
    await tx.payrollRun.update({ where: { id: slip.run.id }, data: { awaitingApproval: false } })
  })

  return getRun(ctx, slip.run.id)
}

/** Remove a manual bonus/deduction line from a draft payslip (not salary/wage). */
export async function removePayslipLine(ctx: OrgContext, lineId: string) {
  const line = await db.payslipLine.findFirst({
    where: { id: lineId, orgId: ctx.orgId },
    include: {
      payslip: {
        include: { run: { select: { id: true, status: true } } },
      },
    },
  })
  if (!line) throw notFound('Payslip line')
  if (line.payslip.run.status !== 'DRAFT') {
    throw precondition('Only draft payroll runs can be adjusted.')
  }
  if (line.code !== 'BONUS' && line.code !== 'DEDUCTION') {
    throw precondition('Only a manual bonus or deduction can be removed.')
  }

  await db.$transaction(async (tx) => {
    await tx.payslipLine.delete({ where: { id: line.id } })
    await recalcPayslip(tx, line.payslipId)
    await tx.payrollRun.update({ where: { id: line.payslip.run.id }, data: { awaitingApproval: false } })
  })

  return getRun(ctx, line.payslip.run.id)
}

export async function postRun(
  ctx: OrgContext,
  id: string,
  opts: {
    payFromAccountId?: string | null
    liabilityAccountId?: string | null
    payMode?: 'IMMEDIATE' | 'ACCRUE' | null
    date?: CalendarDate
  } = {},
) {
  return standardPayroll.standardPost(ctx, id, opts)
}

export async function listPayAccounts(ctx: OrgContext) {
  const chart = await db.ledgerAccount.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: { id: true, code: true, name: true, type: true, subtype: true },
    orderBy: [{ code: 'asc' }],
  })
  return chart.map((row) => ({
    id: row.id,
    label: `${row.code} · ${row.name}`,
    type: row.type,
    subtype: row.subtype,
  }))
}
