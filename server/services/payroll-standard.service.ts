import 'server-only'

import { randomUUID } from 'node:crypto'

import { Decimal } from 'decimal.js'

import { toCalendarDate, today, toDate, type CalendarDate } from '@/lib/date'
import { money, toMoneyString } from '@/lib/money'
import {
  applyAdvances,
  applyOvertimeOverride,
  buildPayrollJournal,
  buildPayrollSettlementJournal,
  buildStandardLines,
  endOfServiceAmount,
  isManualPayslipCode,
  paymentSummaryByMethod,
  periodsOverlap,
  slipTotals,
  type PayMethod,
  type PayMode,
  type SalaryRuleInput,
  type StandardLine,
  type WageType,
} from '@/lib/payroll-standard'
import { postJournal } from '@/server/accounting/posting'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import * as approvalService from '@/server/services/approval.service'
import * as attendanceService from '@/server/services/attendance.service'
import * as hrSettingsService from '@/server/services/hr-settings.service'
import * as leaveService from '@/server/services/leave.service'
import { sendOrgMail } from '@/server/services/mail.service'
import { renderPayslipPdf } from '@/server/reports/payslip-pdf'
import { deleteJournals, restoreJournals } from '@/server/accounting/deletion'

const STANDARD_RULES: { code: string; name: string; kind: 'EARNING' | 'DEDUCTION' | 'EMPLOYER'; calc: 'BASE' | 'FIXED' | 'PERCENT'; sortOrder: number }[] = [
  { code: 'BASIC', name: 'Basic', kind: 'EARNING', calc: 'BASE', sortOrder: 0 },
  { code: 'HOUSING', name: 'Housing', kind: 'EARNING', calc: 'FIXED', sortOrder: 1 },
  { code: 'TRANSPORT', name: 'Transport', kind: 'EARNING', calc: 'FIXED', sortOrder: 2 },
  { code: 'TAX', name: 'Income tax', kind: 'DEDUCTION', calc: 'PERCENT', sortOrder: 10 },
]

export async function ensureStandardStructure(ctx: OrgContext) {
  const existing = await db.salaryStructure.findFirst({
    where: { orgId: ctx.orgId, name: 'Standard' },
    select: { id: true },
  })
  if (existing) {
    await ensureMissingStandardRules(ctx.orgId, existing.id)
    return existing.id
  }
  const created = await db.salaryStructure.create({
    data: {
      orgId: ctx.orgId,
      name: 'Standard',
      rules: {
        create: STANDARD_RULES.map((rule) => ({
          orgId: ctx.orgId,
          code: rule.code,
          name: rule.name,
          kind: rule.kind,
          calc: rule.calc,
          amount: 0,
          sortOrder: rule.sortOrder,
        })),
      },
    },
    select: { id: true },
  })
  return created.id
}

async function ensureMissingStandardRules(orgId: string, structureId: string) {
  const have = await db.salaryRule.findMany({
    where: { structureId },
    select: { code: true },
  })
  const codes = new Set(have.map((row) => row.code))
  const missing = STANDARD_RULES.filter((rule) => !codes.has(rule.code))
  if (missing.length === 0) return
  await db.salaryRule.createMany({
    data: missing.map((rule) => ({
      orgId,
      structureId,
      code: rule.code,
      name: rule.name,
      kind: rule.kind,
      calc: rule.calc,
      amount: 0,
      sortOrder: rule.sortOrder,
    })),
  })
}

export async function createStructure(
  ctx: OrgContext,
  input: { name: string; cloneFromId?: string | null },
) {
  const name = input.name.trim()
  if (!name) throw validation('Give the structure a name.', { name: ['Required'] })
  const clash = await db.salaryStructure.findFirst({
    where: { orgId: ctx.orgId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  })
  if (clash) throw precondition(`A structure named “${name}” already exists.`)

  let rules = STANDARD_RULES.map((rule) => ({
    orgId: ctx.orgId,
    code: rule.code,
    name: rule.name,
    kind: rule.kind,
    calc: rule.calc,
    amount: money(0),
    sortOrder: rule.sortOrder,
    expenseAccountId: null as string | null,
    liabilityAccountId: null as string | null,
  }))
  if (input.cloneFromId) {
    const source = await db.salaryStructure.findFirst({
      where: { id: input.cloneFromId, orgId: ctx.orgId },
      include: { rules: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!source) throw notFound('Salary structure')
    rules = source.rules.map((rule) => ({
      orgId: ctx.orgId,
      code: rule.code,
      name: rule.name,
      kind: rule.kind,
      calc: rule.calc,
      amount: money(rule.amount),
      sortOrder: rule.sortOrder,
      expenseAccountId: rule.expenseAccountId,
      liabilityAccountId: rule.liabilityAccountId,
    }))
  }

  const created = await db.salaryStructure.create({
    data: {
      orgId: ctx.orgId,
      name,
      rules: { create: rules },
    },
    select: { id: true },
  })
  return created.id
}

export async function updateStructureRule(
  ctx: OrgContext,
  input: {
    id: string
    amount?: string
    expenseAccountId?: string | null
    liabilityAccountId?: string | null
    name?: string | null
  },
) {
  const rule = await db.salaryRule.findFirst({
    where: { id: input.id, orgId: ctx.orgId },
    select: { id: true, calc: true },
  })
  if (!rule) throw notFound('Salary rule')
  if (rule.calc === 'BASE' && input.amount != null) {
    throw precondition('Basic uses the employee wage — set the wage on the employee card.')
  }
  await db.salaryRule.update({
    where: { id: rule.id },
    data: {
      ...(input.name != null && input.name !== '' ? { name: input.name.trim() } : {}),
      ...(input.amount != null ? { amount: money(input.amount) } : {}),
      ...(input.expenseAccountId !== undefined ? { expenseAccountId: input.expenseAccountId } : {}),
      ...(input.liabilityAccountId !== undefined
        ? { liabilityAccountId: input.liabilityAccountId }
        : {}),
    },
  })
}

export async function listStructures(ctx: OrgContext) {
  await ensureStandardStructure(ctx)
  const rows = await db.salaryStructure.findMany({
    where: { orgId: ctx.orgId },
    include: { rules: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { name: 'asc' },
  })
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
    rules: row.rules.map((rule) => ({
      id: rule.id,
      code: rule.code,
      name: rule.name,
      kind: rule.kind,
      calc: rule.calc,
      amount: rule.amount.toFixed(4),
      expenseAccountId: rule.expenseAccountId,
      liabilityAccountId: rule.liabilityAccountId,
    })),
  }))
}

export async function addStructureRule(
  ctx: OrgContext,
  input: {
    structureId: string
    code: string
    name: string
    kind: 'EARNING' | 'DEDUCTION' | 'EMPLOYER'
    calc: 'BASE' | 'FIXED' | 'PERCENT'
    amount: string
    expenseAccountId?: string | null
    liabilityAccountId?: string | null
  },
) {
  const structure = await db.salaryStructure.findFirst({
    where: { id: input.structureId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!structure) throw notFound('Salary structure')
  const code = input.code.trim().toUpperCase().replace(/\s+/g, '_')
  if (!code) throw validation('Give the component a code.', { code: ['Required'] })
  const last = await db.salaryRule.findFirst({
    where: { structureId: structure.id },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  await db.salaryRule.create({
    data: {
      orgId: ctx.orgId,
      structureId: structure.id,
      code,
      name: input.name.trim(),
      kind: input.kind,
      calc: input.calc,
      amount: money(input.amount),
      expenseAccountId: input.expenseAccountId ?? null,
      liabilityAccountId: input.liabilityAccountId ?? null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  })
  return listStructures(ctx)
}

export async function removeStructureRule(ctx: OrgContext, id: string) {
  const rule = await db.salaryRule.findFirst({ where: { id, orgId: ctx.orgId }, select: { id: true } })
  if (!rule) throw notFound('Salary rule')
  await db.salaryRule.delete({ where: { id } })
}

export async function listPeople(ctx: OrgContext) {
  const rows = await db.employee.findMany({
    where: { orgId: ctx.orgId, lifecycleStatus: 'ACTIVE', active: true },
    select: { id: true, name: true, department: true },
    orderBy: { name: 'asc' },
  })
  return rows
}

export async function listAdvances(ctx: OrgContext) {
  const rows = await db.employeeAdvance.findMany({
    where: { orgId: ctx.orgId },
    include: { employee: { select: { name: true } } },
    orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  })
  return rows.map((row) => ({
    id: row.id,
    employeeName: row.employee.name,
    kind: row.kind,
    label: row.label,
    principal: row.principal.toFixed(2),
    balance: row.balance.toFixed(2),
    installment: row.installment.toFixed(2),
    active: row.active,
  }))
}

export async function createAdvance(
  ctx: OrgContext,
  input: {
    employeeId: string
    kind: 'LOAN' | 'ADVANCE'
    label: string
    amount: string
    installment: string
    accountId?: string | null
  },
) {
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!employee) throw notFound('Employee')
  const amount = money(input.amount)
  const installment = money(input.installment)
  if (amount.lte(0) || installment.lte(0)) {
    throw validation('Amount and installment must be greater than zero.', { amount: ['Required'] })
  }
  await db.employeeAdvance.create({
    data: {
      orgId: ctx.orgId,
      employeeId: employee.id,
      kind: input.kind,
      label: input.label.trim(),
      principal: amount,
      balance: amount,
      installment,
      accountId: input.accountId ?? null,
    },
  })
}

export async function closeAdvance(ctx: OrgContext, id: string) {
  const row = await db.employeeAdvance.findFirst({ where: { id, orgId: ctx.orgId }, select: { id: true } })
  if (!row) throw notFound('Advance')
  await db.employeeAdvance.update({ where: { id }, data: { active: false } })
}

export async function listEndOfService(ctx: OrgContext) {
  const rows = await db.endOfService.findMany({
    where: { orgId: ctx.orgId },
    include: {
      employee: { select: { name: true } },
      journal: { select: { id: true, journalNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return rows.map((row) => ({
    id: row.id,
    employeeName: row.employee.name,
    asOf: toCalendarDate(row.asOf),
    years: row.years.toFixed(2),
    amount: row.amount.toFixed(2),
    status: row.status,
    journalNumber: row.journal?.journalNumber ?? null,
    journalId: row.journalId,
  }))
}

export async function createEndOfService(
  ctx: OrgContext,
  input: {
    employeeId: string
    asOf: CalendarDate
    monthsPerYear: string
    expenseAccountId?: string | null
    payAccountId?: string | null
    memo?: string | null
  },
) {
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, orgId: ctx.orgId },
    select: { id: true, wageType: true, wageAmount: true, hiredAt: true },
  })
  if (!employee) throw notFound('Employee')
  const monthly =
    employee.wageType === 'MONTHLY'
      ? employee.wageAmount
      : employee.wageType === 'DAILY'
        ? money(employee.wageAmount).times(26)
        : money(employee.wageAmount).times(8).times(26)
  const priced = endOfServiceAmount({
    monthlyWage: monthly.toString(),
    hiredAt: employee.hiredAt ? toCalendarDate(employee.hiredAt) : null,
    asOf: input.asOf,
    monthsPerYear: input.monthsPerYear || '1',
  })
  if (!priced || priced.amount.lte(0)) {
    throw precondition('Set a hire date and a wage before calculating end of service.')
  }
  const row = await db.endOfService.create({
    data: {
      orgId: ctx.orgId,
      employeeId: employee.id,
      asOf: toDate(input.asOf),
      years: priced.years,
      monthlyWage: monthly,
      monthsPerYear: money(input.monthsPerYear || '1'),
      amount: priced.amount,
      memo: input.memo ?? null,
      expenseAccountId: input.expenseAccountId ?? null,
      payAccountId: input.payAccountId ?? null,
      createdById: ctx.userId,
    },
    select: { id: true },
  })
  return row
}

export async function postEndOfService(ctx: OrgContext, id: string) {
  const row = await db.endOfService.findFirst({
    where: { id, orgId: ctx.orgId },
    include: { employee: { select: { name: true, expenseAccountId: true, payableAccountId: true } } },
  })
  if (!row) throw notFound('End of service')
  if (row.status === 'POSTED') throw precondition('This gratuity is already posted.')
  const expense = row.expenseAccountId || row.employee.expenseAccountId
  const credit = row.payAccountId || row.employee.payableAccountId
  if (!expense || !credit) {
    throw precondition('Set an expense account and a payable or bank account.')
  }
  const posted = await db.$transaction(async (tx) => {
    const journal = await postJournal(tx, ctx, {
      date: toCalendarDate(row.asOf),
      memo: row.memo || `End of service · ${row.employee.name}`,
      sourceType: 'PAYROLL',
      sourceId: row.id,
      idempotencyKey: `eos:${row.id}`,
      lines: [
        { accountId: expense, debit: row.amount, description: `End of service · ${row.employee.name}` },
        { accountId: credit, credit: row.amount, description: `End of service payable · ${row.employee.name}` },
      ],
    })
    await tx.endOfService.update({
      where: { id: row.id },
      data: { status: 'POSTED', journalId: journal.id },
    })
    return journal
  })
  return { id: row.id, journalNumber: posted.journalNumber }
}

export async function removeEndOfService(ctx: OrgContext, id: string) {
  const row = await db.endOfService.findFirst({ where: { id, orgId: ctx.orgId }, select: { id: true, status: true } })
  if (!row) throw notFound('End of service')
  if (row.status !== 'DRAFT') throw precondition('Posted gratuity stays in the ledger. Withdraw the journal from Trash if you must.')
  await db.endOfService.delete({ where: { id } })
}

type RunInput = {
  periodStart: CalendarDate
  periodEnd: CalendarDate
  memo?: string | null
  payFromAccountId?: string | null
  liabilityAccountId?: string | null
  payMode?: PayMode | null
  employeeIds?: string[] | null
}

async function numberCursor(tx: Tx, orgId: string) {
  const rows = await tx.payslip.findMany({
    where: { orgId, number: { not: null } },
    select: { number: true },
  })
  let n = 0
  for (const row of rows) {
    const parsed = Number(row.number?.slice(3))
    if (Number.isFinite(parsed)) n = Math.max(n, parsed)
  }
  return {
    next() {
      n += 1
      return `PS-${String(n).padStart(5, '0')}`
    },
  }
}

async function composeSlip(
  ctx: OrgContext,
  emp: {
    id: string
    name: string
    wageType: WageType
    wageAmount: Decimal
    expenseAccountId: string | null
    hiredAt: Date | null
    leftAt: Date | null
    structureId: string | null
  },
  periodStart: CalendarDate,
  periodEnd: CalendarDate,
  settings: { hoursPerDay: string; workDaysPerWeek: number; overtimeAfterHoursPerDay: string; overtimeMultiplier: string },
  rules: SalaryRuleInput[],
  contract: { wageType: WageType; wageAmount: Decimal } | null,
  overrides?: {
    workedDaysOverride?: number | null
    workedHoursOverride?: Decimal | null
    overtimeAmountOverride?: Decimal | null
  },
) {
  const wageType = contract?.wageType ?? emp.wageType
  const wageAmount = contract && money(contract.wageAmount).gt(0) ? contract.wageAmount : emp.wageAmount
  if (money(wageAmount).lte(0)) return { skip: 'No wage', lines: [] as StandardLine[] }
  const unpaid = await leaveService.unpaidLeaveDaysInPeriod(ctx, emp.id, periodStart, periodEnd)
  const attendance =
    wageType === 'HOURLY'
      ? await attendanceService.workedHoursInPeriod(ctx, emp.id, periodStart, periodEnd)
      : null
  const attendedDays =
    wageType === 'DAILY'
      ? await attendanceService.workedDaysInPeriod(ctx, emp.id, periodStart, periodEnd)
      : (attendance?.attendedDays ?? 0)
  const workedDays =
    overrides?.workedDaysOverride != null ? overrides.workedDaysOverride : attendedDays
  const workedHours =
    overrides?.workedHoursOverride != null
      ? overrides.workedHoursOverride.toString()
      : (attendance?.hours.toString() ?? '0')
  const built = buildStandardLines({
    wageType,
    wageAmount: wageAmount.toString(),
    periodStart,
    periodEnd,
    hiredAt: emp.hiredAt ? toCalendarDate(emp.hiredAt) : null,
    leftAt: emp.leftAt ? toCalendarDate(emp.leftAt) : null,
    hoursPerDay: settings.hoursPerDay.toString(),
    workDaysPerWeek: settings.workDaysPerWeek,
    overtimeAfterHoursPerDay: settings.overtimeAfterHoursPerDay.toString(),
    overtimeMultiplier: settings.overtimeMultiplier.toString(),
    workedDays,
    workedHours,
    unpaidLeaveDays: unpaid.toString(),
    expenseAccountId: emp.expenseAccountId,
    rules,
  })
  if (built.skip) return built
  const withOt = applyOvertimeOverride(
    built.lines,
    overrides?.overtimeAmountOverride != null ? overrides.overtimeAmountOverride.toString() : null,
  )
  const advances = await db.employeeAdvance.findMany({
    where: { orgId: ctx.orgId, employeeId: emp.id, active: true, balance: { gt: 0 } },
    orderBy: { createdAt: 'asc' },
  })
  const applied = applyAdvances(
    withOt,
    advances.map((row) => ({
      id: row.id,
      label: row.label,
      balance: row.balance.toString(),
      installment: row.installment.toString(),
      accountId: row.accountId,
    })),
  )
  return { skip: null, lines: applied.lines }
}

function persistLines(orgId: string, lines: StandardLine[]) {
  return lines.map((line) => ({
    orgId,
    code: line.code,
    label: line.label,
    amount: line.amount,
    kind: line.kind,
    sortOrder: line.sortOrder,
    affectsNet: line.affectsNet,
    expenseAccountId: line.expenseAccountId,
    liabilityAccountId: line.liabilityAccountId,
    advanceId: line.advanceId,
  }))
}

export async function standardCreate(ctx: OrgContext, input: RunInput) {
  if (input.periodEnd < input.periodStart) {
    throw validation('Period end must be on or after start.', { periodEnd: ['Must be on or after start'] })
  }
  const warnings: string[] = []
  const others = await db.payrollRun.findMany({
    where: { orgId: ctx.orgId },
    select: { periodStart: true, periodEnd: true },
    take: 100,
  })
  if (
    others.some((row) =>
      periodsOverlap(
        input.periodStart,
        input.periodEnd,
        toCalendarDate(row.periodStart),
        toCalendarDate(row.periodEnd),
      ),
    )
  ) {
    warnings.push('Another payroll run already covers part of these dates.')
  }

  const employees = await db.employee.findMany({
    where: {
      orgId: ctx.orgId,
      active: true,
      leftAt: null,
      ...(input.employeeIds?.length ? { id: { in: input.employeeIds } } : { wageAmount: { gt: 0 } }),
    },
    select: {
      id: true,
      name: true,
      wageType: true,
      wageAmount: true,
      expenseAccountId: true,
      hiredAt: true,
      leftAt: true,
      structureId: true,
    },
  })
  if (employees.length === 0) {
    throw precondition('No employees to pay. Set a wage, or pick people for an off-cycle run.')
  }
  if (employees.some((row) => row.leftAt)) {
    throw precondition('A left employee cannot be included in a new payroll run.')
  }

  const settings = await hrSettingsService.get(ctx)
  const contracts = await db.employeeContract.findMany({
    where: {
      orgId: ctx.orgId,
      state: 'OPEN',
      employeeId: { in: employees.map((row) => row.id) },
      dateStart: { lte: toDate(input.periodEnd) },
      OR: [{ dateEnd: null }, { dateEnd: { gte: toDate(input.periodStart) } }],
    },
    orderBy: { dateStart: 'desc' },
  })
  const contractByEmployee = new Map<string, (typeof contracts)[number]>()
  for (const contract of contracts) {
    if (!contractByEmployee.has(contract.employeeId)) contractByEmployee.set(contract.employeeId, contract)
  }
  const structureIds = [...new Set(employees.map((row) => row.structureId).filter(Boolean))] as string[]
  const structures = structureIds.length
    ? await db.salaryStructure.findMany({
        where: { orgId: ctx.orgId, id: { in: structureIds }, active: true },
        include: { rules: true },
      })
    : []
  const rulesByStructure = new Map(structures.map((row) => [row.id, row.rules]))

  const run = await db.$transaction(async (tx) => {
    const created = await tx.payrollRun.create({
      data: {
        orgId: ctx.orgId,
        periodStart: toDate(input.periodStart),
        periodEnd: toDate(input.periodEnd),
        memo: input.memo ?? null,
        payFromAccountId: input.payFromAccountId ?? null,
        liabilityAccountId: input.liabilityAccountId ?? null,
        payMode: input.payMode ?? 'IMMEDIATE',
        status: 'DRAFT',
        createdById: ctx.userId,
      },
    })
    const numbers = await numberCursor(tx, ctx.orgId)
    for (const emp of employees) {
      const rules = (emp.structureId ? rulesByStructure.get(emp.structureId) : []) ?? []
      const composed = await composeSlip(
        ctx,
        emp,
        input.periodStart,
        input.periodEnd,
        settings,
        rules.map((rule) => ({
          code: rule.code,
          name: rule.name,
          kind: rule.kind,
          calc: rule.calc,
          amount: rule.amount.toString(),
          expenseAccountId: rule.expenseAccountId,
          liabilityAccountId: rule.liabilityAccountId,
          sortOrder: rule.sortOrder,
        })),
        contractByEmployee.get(emp.id) ?? null,
      )
      if (composed.skip || composed.lines.length === 0) {
        warnings.push(`${emp.name}: ${composed.skip ?? 'Nothing to pay'}`)
        continue
      }
      const totals = slipTotals(composed.lines)
      await tx.payslip.create({
        data: {
          orgId: ctx.orgId,
          runId: created.id,
          employeeId: emp.id,
          number: numbers.next(),
          gross: totals.gross,
          deductions: totals.deductions,
          employer: totals.employer,
          net: totals.net,
          lines: { create: persistLines(ctx.orgId, composed.lines) },
        },
      })
    }
    const count = await tx.payslip.count({ where: { runId: created.id } })
    if (count === 0) {
      throw precondition(warnings[0] ?? 'No payslips were built for this period.')
    }
    return created
  })

  return { id: run.id, warnings }
}

export async function recomputeRun(ctx: OrgContext, id: string) {
  const run = await db.payrollRun.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      payslips: { include: { lines: true, employee: true } },
    },
  })
  if (!run) throw notFound('Payroll run')
  if (run.status !== 'DRAFT') throw precondition('Only a draft payroll can be recomputed.')
  const periodStart = toCalendarDate(run.periodStart)
  const periodEnd = toCalendarDate(run.periodEnd)
  const settings = await hrSettingsService.get(ctx)
  const warnings: string[] = []

  await db.$transaction(async (tx) => {
    const numbers = await numberCursor(tx, ctx.orgId)
    for (const slip of run.payslips) {
      if (!slip.included) continue
      const manual = slip.lines.filter((line) => isManualPayslipCode(line.code))
      const rules = slip.employee.structureId
        ? await tx.salaryRule.findMany({ where: { structureId: slip.employee.structureId } })
        : []
      const contract = await tx.employeeContract.findFirst({
        where: {
          orgId: ctx.orgId,
          employeeId: slip.employeeId,
          state: 'OPEN',
          dateStart: { lte: run.periodEnd },
          OR: [{ dateEnd: null }, { dateEnd: { gte: run.periodStart } }],
        },
        orderBy: { dateStart: 'desc' },
      })
      const composed = await composeSlip(
        ctx,
        slip.employee,
        periodStart,
        periodEnd,
        settings,
        rules.map((rule) => ({
          code: rule.code,
          name: rule.name,
          kind: rule.kind,
          calc: rule.calc,
          amount: rule.amount.toString(),
          expenseAccountId: rule.expenseAccountId,
          liabilityAccountId: rule.liabilityAccountId,
          sortOrder: rule.sortOrder,
        })),
        contract,
        {
          workedDaysOverride: slip.workedDaysOverride,
          workedHoursOverride: slip.workedHoursOverride,
          overtimeAmountOverride: slip.overtimeAmountOverride,
        },
      )
      if (composed.skip) {
        warnings.push(`${slip.employee.name}: ${composed.skip}`)
        await tx.payslipLine.deleteMany({ where: { payslipId: slip.id, code: { notIn: ['BONUS', 'DEDUCTION'] } } })
        const keptOnly = slipTotals(
          manual.map((line) => ({
            kind: line.kind,
            amount: money(line.amount),
            affectsNet: line.affectsNet,
          })),
        )
        await tx.payslip.update({
          where: { id: slip.id },
          data: {
            included: false,
            gross: keptOnly.gross,
            deductions: keptOnly.deductions,
            employer: keptOnly.employer,
            net: keptOnly.net,
          },
        })
        continue
      }
      await tx.payslipLine.deleteMany({ where: { payslipId: slip.id, code: { notIn: ['BONUS', 'DEDUCTION'] } } })
      if (composed.lines.length) {
        await tx.payslipLine.createMany({
          data: persistLines(ctx.orgId, composed.lines).map((line) => ({ ...line, payslipId: slip.id })),
        })
      }
      const kept = [
        ...composed.lines,
        ...manual.map((line) => ({
          code: line.code,
          label: line.label,
          amount: money(line.amount),
          kind: line.kind,
          affectsNet: line.affectsNet,
        })),
      ]
      const totals = slipTotals(kept)
      await tx.payslip.update({
        where: { id: slip.id },
        data: {
          gross: totals.gross,
          deductions: totals.deductions,
          employer: totals.employer,
          net: totals.net,
          number: slip.number ?? numbers.next(),
        },
      })
    }
    await tx.payrollRun.update({ where: { id: run.id }, data: { awaitingApproval: false } })
    await cancelPendingPayrollApproval(tx, ctx.orgId, run.id)
  })
  return warnings
}

export async function setIncluded(ctx: OrgContext, payslipId: string, included: boolean) {
  const slip = await db.payslip.findFirst({
    where: { id: payslipId, orgId: ctx.orgId },
    include: { run: { select: { id: true, status: true } } },
  })
  if (!slip) throw notFound('Payslip')
  if (slip.run.status !== 'DRAFT') throw precondition('Only a draft payroll can change who is paid.')
  await db.$transaction(async (tx) => {
    await tx.payslip.update({ where: { id: slip.id }, data: { included } })
    await tx.payrollRun.update({ where: { id: slip.run.id }, data: { awaitingApproval: false } })
    await cancelPendingPayrollApproval(tx, ctx.orgId, slip.run.id)
  })
  return slip.run.id
}

export async function cancelPendingPayrollApproval(tx: Tx, orgId: string, runId: string) {
  await tx.approvalRequest.updateMany({
    where: { orgId, entityType: 'PAYROLL', entityId: runId, status: 'PENDING' },
    data: { status: 'CANCELLED', decidedAt: new Date() },
  })
}

export async function submitRun(
  ctx: OrgContext,
  id: string,
  opts: { payFromAccountId?: string | null; liabilityAccountId?: string | null; payMode?: PayMode | null },
) {
  const run = await db.payrollRun.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      payslips: { where: { included: true }, select: { net: true } },
    },
  })
  if (!run) throw notFound('Payroll run')
  if (run.status !== 'DRAFT') throw precondition('This run is already posted.')
  const totalNet = run.payslips.reduce((sum, slip) => sum.plus(slip.net), money(0))

  await db.$transaction(async (tx) => {
    await tx.payrollRun.update({
      where: { id },
      data: {
        awaitingApproval: true,
        ...(opts.payFromAccountId ? { payFromAccountId: opts.payFromAccountId } : {}),
        ...(opts.liabilityAccountId ? { liabilityAccountId: opts.liabilityAccountId } : {}),
        ...(opts.payMode ? { payMode: opts.payMode } : {}),
      },
    })
    const gate = await approvalService.needsApproval(ctx, 'PAYROLL', totalNet, tx)
    if (gate.required) {
      await approvalService.submitRequest(tx, ctx, {
        entityType: 'PAYROLL',
        entityId: id,
        title: `Payroll ${toCalendarDate(run.periodStart)} – ${toCalendarDate(run.periodEnd)}`,
        href: `/employees/payroll/${id}`,
        amount: totalNet,
        levels: gate.levels,
        policyId: gate.policyId,
      })
    }
  })
}

export async function setPayslipAttendance(
  ctx: OrgContext,
  input: {
    payslipId: string
    workedDaysOverride?: number | null
    workedHoursOverride?: string | null
    overtimeAmountOverride?: string | null
  },
) {
  const slip = await db.payslip.findFirst({
    where: { id: input.payslipId, orgId: ctx.orgId },
    include: { run: true, employee: true, lines: true },
  })
  if (!slip) throw notFound('Payslip')
  if (slip.run.status !== 'DRAFT') throw precondition('Only a draft payroll can change attendance.')

  await db.$transaction(async (tx) => {
    await tx.payslip.update({
      where: { id: slip.id },
      data: {
        ...(input.workedDaysOverride !== undefined
          ? { workedDaysOverride: input.workedDaysOverride }
          : {}),
        ...(input.workedHoursOverride !== undefined
          ? {
              workedHoursOverride:
                input.workedHoursOverride == null || input.workedHoursOverride === ''
                  ? null
                  : money(input.workedHoursOverride),
            }
          : {}),
        ...(input.overtimeAmountOverride !== undefined
          ? {
              overtimeAmountOverride:
                input.overtimeAmountOverride == null || input.overtimeAmountOverride === ''
                  ? null
                  : money(input.overtimeAmountOverride),
            }
          : {}),
      },
    })
    await tx.payrollRun.update({ where: { id: slip.runId }, data: { awaitingApproval: false } })
    await cancelPendingPayrollApproval(tx, ctx.orgId, slip.runId)
  })

  await recomputeRun(ctx, slip.runId)
  return slip.runId
}

export async function settlePayrollRun(
  ctx: OrgContext,
  id: string,
  opts: { payFromAccountId?: string | null; date?: CalendarDate } = {},
) {
  const run = await db.payrollRun.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      payslips: {
        where: { included: true },
        include: { employee: true },
      },
    },
  })
  if (!run) throw notFound('Payroll run')
  if (run.status !== 'POSTED') throw precondition('Post the payroll before paying it.')
  if (run.payMode !== 'ACCRUE') throw precondition('Only accrued payroll needs a separate payment.')
  if (run.settlementJournalId) throw precondition('This payroll was already paid.')
  if (run.payslips.length === 0) throw precondition('No payslips to pay.')

  const payFromId = opts.payFromAccountId || run.payFromAccountId
  const journal = buildPayrollSettlementJournal({
    payFromAccountId: payFromId,
    liabilityAccountId: run.liabilityAccountId,
    slips: run.payslips.map((slip) => ({
      name: slip.employee.name,
      department: slip.employee.department,
      payableAccountId: slip.employee.payableAccountId,
      payAccountId: slip.employee.payAccountId,
      payMethod: slip.employee.payMethod as PayMethod,
      net: slip.net.toString(),
    })),
  })
  if (journal.error) throw precondition(journal.error)

  const posted = await db.$transaction(async (tx) => {
    const stableKey = `payroll-settle:${run.id}`
    const prior = await tx.journal.findUnique({
      where: { orgId_idempotencyKey: { orgId: ctx.orgId, idempotencyKey: stableKey } },
      select: { id: true, status: true },
    })
    const idempotencyKey =
      prior && prior.status === 'DELETED' ? `payroll-settle:${run.id}:${randomUUID()}` : stableKey
    const created = await postJournal(tx, ctx, {
      date: opts.date ?? today(),
      memo: `Pay wages ${toCalendarDate(run.periodStart)} – ${toCalendarDate(run.periodEnd)}`,
      sourceType: 'PAYROLL_SETTLEMENT',
      sourceId: run.id,
      idempotencyKey,
      lines: journal.lines.map((line) => ({
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      })),
    })
    await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        settlementJournalId: created.id,
        paidAt: new Date(),
        ...(payFromId ? { payFromAccountId: payFromId } : {}),
      },
    })
    return created
  })

  return {
    journalId: posted.id,
    journalNumber: posted.journalNumber,
    total: run.payslips.reduce((sum, slip) => sum.plus(slip.net), money(0)).toFixed(2),
  }
}

export function summarizePayMethods(
  slips: { payMethod: PayMethod; net: string; included?: boolean }[],
) {
  return paymentSummaryByMethod(slips).map((row) => ({
    method: row.method,
    count: row.count,
    net: row.net.toFixed(2),
  }))
}

export async function standardPost(
  ctx: OrgContext,
  id: string,
  opts: {
    payFromAccountId?: string | null
    liabilityAccountId?: string | null
    payMode?: PayMode | null
    date?: CalendarDate
  } = {},
  client: Tx | typeof db = db,
) {
  const run = await client.payrollRun.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      payslips: {
        where: { included: true },
        include: { lines: true, employee: true },
      },
    },
  })
  if (!run) throw notFound('Payroll run')
  if (run.status !== 'DRAFT') throw precondition('This run is already posted.')
  if (!run.awaitingApproval) {
    throw precondition('Submit this payroll for approval before posting.')
  }
  if (opts.payMode || opts.liabilityAccountId || opts.payFromAccountId) {
    await client.payrollRun.update({
      where: { id: run.id },
      data: {
        ...(opts.payMode ? { payMode: opts.payMode } : {}),
        ...(opts.liabilityAccountId ? { liabilityAccountId: opts.liabilityAccountId } : {}),
        ...(opts.payFromAccountId ? { payFromAccountId: opts.payFromAccountId } : {}),
      },
    })
    if (opts.payMode) run.payMode = opts.payMode
    if (opts.liabilityAccountId) run.liabilityAccountId = opts.liabilityAccountId
    if (opts.payFromAccountId) run.payFromAccountId = opts.payFromAccountId
  }
  if (run.payslips.length === 0) throw precondition('No payslips to post.')

  const payFromId = opts.payFromAccountId || run.payFromAccountId
  const journal = buildPayrollJournal({
    payMode: run.payMode,
    payFromAccountId: payFromId,
    liabilityAccountId: run.liabilityAccountId,
    slips: run.payslips.map((slip) => ({
      name: slip.employee.name,
      department: slip.employee.department,
      expenseAccountId: slip.employee.expenseAccountId,
      payableAccountId: slip.employee.payableAccountId,
      payAccountId: slip.employee.payAccountId,
      payMethod: slip.employee.payMethod as PayMethod,
      lines: slip.lines.map((line) => ({
        code: line.code,
        label: line.label,
        amount: line.amount.toString(),
        kind: line.kind,
        affectsNet: line.affectsNet,
        expenseAccountId: line.expenseAccountId,
        liabilityAccountId: line.liabilityAccountId,
      })),
    })),
  })
  if (journal.error) throw precondition(journal.error)

  const write = async (tx: Tx) => {
    for (const slip of run.payslips) {
      const byAdvance = new Map<string, Decimal>()
      for (const line of slip.lines) {
        if (!line.advanceId) continue
        byAdvance.set(line.advanceId, (byAdvance.get(line.advanceId) ?? money(0)).plus(line.amount))
      }
      for (const [advanceId, amount] of byAdvance) {
        const advance = await tx.employeeAdvance.findFirst({
          where: { id: advanceId, orgId: ctx.orgId },
        })
        if (!advance) throw precondition('An advance on this payroll no longer exists. Recompute the draft.')
        if (money(advance.balance).lt(amount)) {
          throw precondition('An advance balance changed. Recompute the draft before posting.')
        }
        const next = money(advance.balance).minus(amount)
        await tx.employeeAdvance.update({
          where: { id: advance.id },
          data: { balance: next, active: next.gt(0) },
        })
        await tx.advanceRecovery.create({
          data: { orgId: ctx.orgId, advanceId: advance.id, payslipId: slip.id, amount },
        })
      }
    }

    const stableKey = `payroll:${run.id}`
    const prior = await tx.journal.findUnique({
      where: { orgId_idempotencyKey: { orgId: ctx.orgId, idempotencyKey: stableKey } },
      select: { id: true, status: true },
    })
    const idempotencyKey =
      prior && prior.status === 'DELETED' ? `payroll:${run.id}:${randomUUID()}` : stableKey
    const created = await postJournal(tx, ctx, {
      date: opts.date ?? toCalendarDate(run.periodEnd),
      memo: run.memo ?? `Payroll ${toCalendarDate(run.periodStart)} – ${toCalendarDate(run.periodEnd)}`,
      sourceType: 'PAYROLL',
      sourceId: run.id,
      idempotencyKey,
      lines: journal.lines.map((line) => ({
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      })),
    })
    await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        status: 'POSTED',
        journalId: created.id,
        postedAt: new Date(),
        payFromAccountId: payFromId,
        awaitingApproval: false,
      },
    })
    return created
  }

  const posted =
    client === db ? await db.$transaction((tx) => write(tx)) : await write(client as Tx)

  const total = run.payslips.reduce((sum, slip) => sum.plus(slip.net), money(0))
  return {
    id: run.id,
    journalId: posted.id,
    journalNumber: posted.journalNumber,
    total: toMoneyString(total),
  }
}

export async function restoreAdvanceRecoveries(tx: Tx, orgId: string, runId: string) {
  const recoveries = await tx.advanceRecovery.findMany({
    where: { orgId, payslip: { runId } },
  })
  for (const row of recoveries) {
    const advance = await tx.employeeAdvance.findFirst({ where: { id: row.advanceId, orgId } })
    if (!advance) continue
    const next = money(advance.balance).plus(row.amount)
    await tx.employeeAdvance.update({
      where: { id: advance.id },
      data: { balance: next, active: true },
    })
  }
  if (recoveries.length) {
    await tx.advanceRecovery.deleteMany({ where: { id: { in: recoveries.map((row) => row.id) } } })
  }
}

export async function payrollReport(ctx: OrgContext, from: CalendarDate, to: CalendarDate) {
  const slips = await db.payslip.findMany({
    where: {
      orgId: ctx.orgId,
      included: true,
      run: { status: 'POSTED', periodEnd: { gte: toDate(from), lte: toDate(to) } },
    },
    include: { employee: { select: { department: true } } },
  })
  const groups = new Map<string, { gross: Decimal; deductions: Decimal; employer: Decimal; net: Decimal; people: number }>()
  for (const slip of slips) {
    const key = slip.employee.department?.trim() || 'Unassigned'
    const row = groups.get(key) ?? { gross: money(0), deductions: money(0), employer: money(0), net: money(0), people: 0 }
    row.gross = row.gross.plus(slip.gross)
    row.deductions = row.deductions.plus(slip.deductions)
    row.employer = row.employer.plus(slip.employer)
    row.net = row.net.plus(slip.net)
    row.people += 1
    groups.set(key, row)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([department, row]) => ({
      department,
      people: row.people,
      gross: row.gross.toFixed(2),
      deductions: row.deductions.toFixed(2),
      employer: row.employer.toFixed(2),
      net: row.net.toFixed(2),
    }))
}

export async function myPayslips(ctx: OrgContext) {
  const employee = await db.employee.findFirst({
    where: { orgId: ctx.orgId, userId: ctx.userId },
    select: { id: true, name: true },
  })
  if (!employee) return { employeeName: null as string | null, slips: [] }
  const rows = await db.payslip.findMany({
    where: { orgId: ctx.orgId, employeeId: employee.id, included: true },
    include: { run: { select: { id: true, periodStart: true, periodEnd: true, status: true } } },
    orderBy: { run: { periodStart: 'desc' } },
    take: 36,
  })
  return {
    employeeName: employee.name,
    slips: rows.map((row) => ({
      id: row.id,
      runId: row.run.id,
      number: row.number,
      periodStart: toCalendarDate(row.run.periodStart),
      periodEnd: toCalendarDate(row.run.periodEnd),
      status: row.run.status,
      net: row.net.toFixed(2),
    })),
  }
}

async function loadPayslipPdf(ctx: OrgContext, payslipId: string) {
  const slip = await db.payslip.findFirst({
    where: { id: payslipId, orgId: ctx.orgId },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      employee: { select: { id: true, name: true, department: true, userId: true, workEmail: true } },
      run: { select: { id: true, periodStart: true, periodEnd: true, status: true } },
    },
  })
  if (!slip) throw notFound('Payslip')
  const allowed = ctx.permissions.has('hr:payroll') || ctx.permissions.has('hr:read') || slip.employee.userId === ctx.userId
  if (!allowed) throw precondition('You can only open your own payslip.')
  const year = toCalendarDate(slip.run.periodEnd).slice(0, 4)
  const ytdRows = await db.payslip.findMany({
    where: {
      orgId: ctx.orgId,
      employeeId: slip.employeeId,
      included: true,
      run: {
        status: 'POSTED',
        periodEnd: { gte: toDate(`${year}-01-01`), lte: toDate(`${year}-12-31`) },
      },
    },
    select: { gross: true, net: true },
  })
  const ytdNet = ytdRows.reduce((sum, row) => sum.plus(row.net), money(0))
  const ytdGross = ytdRows.reduce((sum, row) => sum.plus(row.gross), money(0))
  return { slip, ytdNet, ytdGross }
}

export async function payslipPdf(ctx: OrgContext, payslipId: string) {
  const { slip, ytdNet, ytdGross } = await loadPayslipPdf(ctx, payslipId)
  const bytes = renderPayslipPdf({
    orgName: ctx.organization.name,
    number: slip.number ?? slip.id.slice(-6),
    employeeName: slip.employee.name,
    department: slip.employee.department,
    periodStart: toCalendarDate(slip.run.periodStart),
    periodEnd: toCalendarDate(slip.run.periodEnd),
    gross: slip.gross.toFixed(2),
    deductions: slip.deductions.toFixed(2),
    employer: slip.employer.toFixed(2),
    net: slip.net.toFixed(2),
    ytdGross: ytdGross.toFixed(2),
    ytdNet: ytdNet.toFixed(2),
    lines: slip.lines.map((line) => ({
      label: line.label,
      amount: line.amount.toFixed(2),
      kind: line.kind,
      affectsNet: line.affectsNet,
    })),
  })
  return { bytes, filename: `${slip.number ?? 'payslip'}.pdf`, slip }
}

export async function emailPayslip(ctx: OrgContext, payslipId: string) {
  const { bytes, filename, slip } = await payslipPdf(ctx, payslipId)
  const to = slip.employee.workEmail
  if (!to) throw precondition(`${slip.employee.name} has no work email.`)
  await sendOrgMail(ctx, {
    to,
    subject: `Payslip ${slip.number ?? ''} ${toCalendarDate(slip.run.periodStart)}`.trim(),
    text: `Payslip for ${slip.employee.name}. Net pay ${slip.net.toFixed(2)}.`,
    fromName: ctx.organization.name,
    attachments: [{ filename, content: Buffer.from(bytes), contentType: 'application/pdf' }],
  })
  return { to }
}
