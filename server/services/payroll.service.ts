import 'server-only'

import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { Decimal, money, toMoneyString } from '@/lib/money'
import { postJournal } from '@/server/accounting/posting'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import * as attendanceService from '@/server/services/attendance.service'
import * as hrSettingsService from '@/server/services/hr-settings.service'
import * as leaveService from '@/server/services/leave.service'

function calendarDaysInclusive(from: CalendarDate, to: CalendarDate): number {
  const a = toDate(from).getTime()
  const b = toDate(to).getTime()
  return Math.floor((b - a) / 86_400_000) + 1
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
  }))
}

export async function getRun(ctx: OrgContext, id: string) {
  const row = await db.payrollRun.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      journal: { select: { id: true, journalNumber: true } },
      payslips: {
        include: {
          employee: { select: { id: true, name: true, department: true } },
          lines: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { employee: { name: 'asc' } },
      },
    },
  })
  if (!row) throw notFound('Payroll run')
  return {
    id: row.id,
    periodStart: toCalendarDate(row.periodStart),
    periodEnd: toCalendarDate(row.periodEnd),
    memo: row.memo,
    status: row.status,
    payFromAccountId: row.payFromAccountId,
    journalId: row.journalId,
    journalNumber: row.journal?.journalNumber ?? null,
    postedAt: row.postedAt,
    payslips: row.payslips.map((slip) => ({
      id: slip.id,
      employeeId: slip.employeeId,
      employeeName: slip.employee.name,
      department: slip.employee.department,
      gross: slip.gross.toFixed(4),
      deductions: slip.deductions.toFixed(4),
      net: slip.net.toFixed(4),
      lines: slip.lines.map((line) => ({
        id: line.id,
        code: line.code,
        label: line.label,
        amount: line.amount.toFixed(4),
        kind: line.kind,
      })),
    })),
  }
}

export async function createRun(
  ctx: OrgContext,
  input: {
    periodStart: CalendarDate
    periodEnd: CalendarDate
    memo?: string | null
    payFromAccountId?: string | null
  },
) {
  if (input.periodEnd < input.periodStart) {
    throw validation('Period end must be on or after start.', {
      periodEnd: ['Must be on or after start'],
    })
  }

  const employees = await db.employee.findMany({
    where: {
      orgId: ctx.orgId,
      active: true,
      wageAmount: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      wageType: true,
      wageAmount: true,
      expenseAccountId: true,
    },
  })

  if (employees.length === 0) {
    throw precondition('No active employees with a wage amount. Set wages on the employee card first.')
  }

  const periodDays = calendarDaysInclusive(input.periodStart, input.periodEnd)
  const settings = await hrSettingsService.get(ctx)
  const hoursPerDay = money(settings.hoursPerDay)
  const otAfter = money(settings.overtimeAfterHoursPerDay)
  const otMult = money(settings.overtimeMultiplier)

  const run = await db.$transaction(async (tx) => {
    const created = await tx.payrollRun.create({
      data: {
        orgId: ctx.orgId,
        periodStart: toDate(input.periodStart),
        periodEnd: toDate(input.periodEnd),
        memo: input.memo ?? null,
        payFromAccountId: input.payFromAccountId ?? null,
        status: 'DRAFT',
        createdById: ctx.userId,
      },
    })

    for (const emp of employees) {
      const unpaid = await leaveService.unpaidLeaveDaysInPeriod(
        ctx,
        emp.id,
        input.periodStart,
        input.periodEnd,
      )

      let gross = money(0)
      const lines: { code: string; label: string; amount: Decimal; kind: 'EARNING' | 'DEDUCTION'; sortOrder: number }[] =
        []

      if (emp.wageType === 'DAILY') {
        const attended = await attendanceService.workedDaysInPeriod(
          ctx,
          emp.id,
          input.periodStart,
          input.periodEnd,
        )
        const days = Math.max(0, attended - Number(unpaid.toFixed(0)))
        gross = money(emp.wageAmount).times(days)
        lines.push({
          code: 'WAGE',
          label: `Daily wage × ${days} days`,
          amount: gross,
          kind: 'EARNING',
          sortOrder: 0,
        })
      } else if (emp.wageType === 'HOURLY') {
        const { hours: rawHours, attendedDays } = await attendanceService.workedHoursInPeriod(
          ctx,
          emp.id,
          input.periodStart,
          input.periodEnd,
        )
        const unpaidHours = hoursPerDay.times(unpaid)
        const payableHours = Decimal.max(rawHours.minus(unpaidHours), money(0))
        const regularCap = otAfter.times(Math.max(attendedDays, 1))
        const regularHours = Decimal.min(payableHours, regularCap)
        const otHours = Decimal.max(payableHours.minus(regularHours), money(0))
        const rate = money(emp.wageAmount)
        const regularPay = rate.times(regularHours)
        const otPay = rate.times(otMult).times(otHours)
        lines.push({
          code: 'HOURS',
          label: `Hourly × ${regularHours.toFixed(2)} h`,
          amount: regularPay,
          kind: 'EARNING',
          sortOrder: 0,
        })
        if (otPay.gt(0)) {
          lines.push({
            code: 'OT',
            label: `Overtime × ${otHours.toFixed(2)} h (×${otMult.toFixed(2)})`,
            amount: otPay,
            kind: 'EARNING',
            sortOrder: 1,
          })
        }
        gross = regularPay.plus(otPay)
      } else {
        const base = money(emp.wageAmount)
        const daily = periodDays > 0 ? base.div(periodDays) : money(0)
        const unpaidAmount = daily.times(unpaid)
        gross = Decimal.max(base.minus(unpaidAmount), money(0))
        lines.push({
          code: 'SALARY',
          label: 'Monthly salary',
          amount: base,
          kind: 'EARNING',
          sortOrder: 0,
        })
        if (unpaidAmount.gt(0)) {
          lines.push({
            code: 'UNPAID_LEAVE',
            label: `Unpaid leave (${unpaid.toFixed(2)} days)`,
            amount: unpaidAmount,
            kind: 'DEDUCTION',
            sortOrder: 1,
          })
        }
      }

      const deductions = lines
        .filter((line) => line.kind === 'DEDUCTION')
        .reduce((sum, line) => sum.plus(line.amount), money(0))
      const earnings = lines
        .filter((line) => line.kind === 'EARNING')
        .reduce((sum, line) => sum.plus(line.amount), money(0))
      const net = Decimal.max(earnings.minus(deductions), money(0))

      await tx.payslip.create({
        data: {
          orgId: ctx.orgId,
          runId: created.id,
          employeeId: emp.id,
          gross: earnings,
          deductions,
          net,
          lines: {
            create: lines.map((line) => ({
              orgId: ctx.orgId,
              code: line.code,
              label: line.label,
              amount: line.amount,
              kind: line.kind,
              sortOrder: line.sortOrder,
            })),
          },
        },
      })
    }

    return created
  })

  return getRun(ctx, run.id)
}

export async function removeRun(ctx: OrgContext, id: string) {
  const row = await db.payrollRun.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!row) throw notFound('Payroll run')
  if (row.status !== 'DRAFT') throw precondition('Only draft runs can be deleted.')
  await db.payrollRun.delete({ where: { id } })
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
    throw precondition('Only draft payroll runs can be adjusted. Unpost is not available — create a new run.')
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
  if (line.code === 'SALARY' || line.code === 'WAGE' || line.code === 'UNPAID_LEAVE') {
    throw precondition('Base wage and unpaid-leave lines cannot be removed. Change the employee wage or leave instead.')
  }

  await db.$transaction(async (tx) => {
    await tx.payslipLine.delete({ where: { id: line.id } })
    await recalcPayslip(tx, line.payslipId)
  })

  return getRun(ctx, line.payslip.run.id)
}

export async function postRun(
  ctx: OrgContext,
  id: string,
  opts: { payFromAccountId?: string | null; date?: CalendarDate } = {},
) {
  const run = await db.payrollRun.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      payslips: {
        include: {
          employee: {
            select: { id: true, name: true, expenseAccountId: true },
          },
        },
      },
    },
  })
  if (!run) throw notFound('Payroll run')
  if (run.status !== 'DRAFT') throw precondition('This run is already posted.')
  if (run.payslips.length === 0) throw precondition('No payslips to post.')

  const payFromId = opts.payFromAccountId || run.payFromAccountId
  if (!payFromId) {
    throw validation('Choose the bank or cash account to pay from.', {
      payFromAccountId: ['Required to post'],
    })
  }

  const payFrom = await db.ledgerAccount.findFirst({
    where: { id: payFromId, orgId: ctx.orgId, isActive: true },
    select: { id: true },
  })
  if (!payFrom) throw validation('Pay-from account not found.', { payFromAccountId: ['Invalid'] })

  const missingExpense = run.payslips.filter((slip) => !slip.employee.expenseAccountId)
  if (missingExpense.length > 0) {
    throw precondition(
      `Set a wage expense account on: ${missingExpense
        .slice(0, 5)
        .map((s) => s.employee.name)
        .join(', ')}${missingExpense.length > 5 ? '…' : ''}`,
    )
  }

  const byExpense = new Map<string, Decimal>()
  let totalNet = money(0)
  for (const slip of run.payslips) {
    const accountId = slip.employee.expenseAccountId!
    byExpense.set(accountId, (byExpense.get(accountId) ?? money(0)).plus(slip.net))
    totalNet = totalNet.plus(slip.net)
  }
  if (totalNet.isZero()) {
    throw precondition('Payslip net total is zero — nothing to post.')
  }

  const postDate = opts.date ?? toCalendarDate(run.periodEnd)

  const posted = await db.$transaction(async (tx) => {
    const journal = await postJournal(tx, ctx, {
      date: postDate,
      memo: run.memo ?? `Payroll ${toCalendarDate(run.periodStart)} – ${toCalendarDate(run.periodEnd)}`,
      sourceType: 'PAYROLL',
      sourceId: run.id,
      idempotencyKey: `payroll:${run.id}`,
      lines: [
        ...[...byExpense.entries()].map(([accountId, amount]) => ({
          accountId,
          debit: amount,
          description: 'Payroll wages',
        })),
        {
          accountId: payFromId,
          credit: totalNet,
          description: 'Payroll payment',
        },
      ],
    })

    await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        status: 'POSTED',
        journalId: journal.id,
        postedAt: new Date(),
        payFromAccountId: payFromId,
      },
    })

    return journal
  })

  return {
    id: run.id,
    journalId: posted.id,
    journalNumber: posted.journalNumber,
    total: toMoneyString(totalNet),
  }
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
