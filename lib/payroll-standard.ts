import { Decimal } from 'decimal.js'

import { money, type Money } from '@/lib/money'

export type PayMethod = 'CASH' | 'BANK' | 'MOBILE'
export type PayMode = 'IMMEDIATE' | 'ACCRUE'
export type WageType = 'MONTHLY' | 'DAILY' | 'HOURLY'
export type RuleKind = 'EARNING' | 'DEDUCTION' | 'EMPLOYER'
export type RuleCalc = 'BASE' | 'FIXED' | 'PERCENT'

export type StandardLine = {
  code: string
  label: string
  amount: Money
  kind: 'EARNING' | 'DEDUCTION'
  affectsNet: boolean
  sortOrder: number
  expenseAccountId: string | null
  liabilityAccountId: string | null
  advanceId: string | null
}

export type SalaryRuleInput = {
  code: string
  name: string
  kind: RuleKind
  calc: RuleCalc
  amount: string
  expenseAccountId: string | null
  liabilityAccountId: string | null
  sortOrder: number
}

const MANUAL_CODES = new Set(['BONUS', 'DEDUCTION'])

export function isManualPayslipCode(code: string): boolean {
  return MANUAL_CODES.has(code)
}

export function calendarDaysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  return Math.floor((b - a) / 86_400_000) + 1
}

export function periodsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

/** Working days implied by a company week, spread across the calendar period. */
export function workingDaysInPeriod(periodDays: number, workDaysPerWeek: number): number {
  if (periodDays <= 0) return 1
  const perWeek = Math.min(7, Math.max(1, workDaysPerWeek))
  return Math.max(1, Math.round((periodDays * perWeek) / 7))
}

export function employmentWindow(
  periodStart: string,
  periodEnd: string,
  hiredAt: string | null,
  leftAt: string | null,
): { start: string; end: string; overlapDays: number; periodDays: number } | null {
  const start = hiredAt && hiredAt > periodStart ? hiredAt : periodStart
  const end = leftAt && leftAt < periodEnd ? leftAt : periodEnd
  if (end < start) return null
  const overlapDays = calendarDaysInclusive(start, end)
  const periodDays = calendarDaysInclusive(periodStart, periodEnd)
  if (overlapDays <= 0 || periodDays <= 0) return null
  return { start, end, overlapDays, periodDays }
}

function line(input: Omit<StandardLine, 'amount' | 'advanceId'> & { amount: Money; advanceId?: string | null }): StandardLine {
  return { advanceId: null, ...input }
}

function wageLines(input: {
  wageType: WageType
  wage: Money
  fraction: Money
  overlapDays: number
  periodDays: number
  workingDays: number
  hoursPerDay: Money
  otAfter: Money
  otMult: Money
  workedDays: number
  workedHours: Money
  unpaidDays: Money
  expenseAccountId: string | null
}): { base: Money; lines: StandardLine[] } {
  const lines: StandardLine[] = []
  const expense = input.expenseAccountId

  if (input.wageType === 'DAILY') {
    const days = Math.max(0, input.workedDays - Number(input.unpaidDays.toFixed(0)))
    const amount = input.wage.times(days)
    lines.push(
      line({
        code: 'WAGE',
        label: `Daily wage × ${days} days`,
        amount,
        kind: 'EARNING',
        affectsNet: true,
        sortOrder: 0,
        expenseAccountId: expense,
        liabilityAccountId: null,
      }),
    )
    return { base: amount, lines }
  }

  if (input.wageType === 'HOURLY') {
    const unpaidHours = input.hoursPerDay.times(input.unpaidDays)
    const payableHours = Decimal.max(input.workedHours.minus(unpaidHours), money(0))
    const regularCap = input.otAfter.times(Math.max(input.workedDays, 1))
    const regularHours = Decimal.min(payableHours, regularCap)
    const otHours = Decimal.max(payableHours.minus(regularHours), money(0))
    const regularPay = input.wage.times(regularHours)
    const otPay = input.wage.times(input.otMult).times(otHours)
    lines.push(
      line({
        code: 'HOURS',
        label: `Hourly × ${regularHours.toFixed(2)} h`,
        amount: regularPay,
        kind: 'EARNING',
        affectsNet: true,
        sortOrder: 0,
        expenseAccountId: expense,
        liabilityAccountId: null,
      }),
    )
    if (otPay.gt(0)) {
      lines.push(
        line({
          code: 'OT',
          label: `Overtime × ${otHours.toFixed(2)} h (×${input.otMult.toFixed(2)})`,
          amount: otPay,
          kind: 'EARNING',
          affectsNet: true,
          sortOrder: 1,
          expenseAccountId: expense,
          liabilityAccountId: null,
        }),
      )
    }
    return { base: regularPay.plus(otPay), lines }
  }

  const base = input.wage.times(input.fraction)
  const daily = input.workingDays > 0 ? input.wage.div(input.workingDays) : money(0)
  const unpaid = Decimal.min(base, daily.times(input.unpaidDays))
  const salaryLabel =
    input.overlapDays === input.periodDays
      ? 'Monthly salary'
      : `Monthly salary (${input.overlapDays}/${input.periodDays} days)`
  lines.push(
    line({
      code: 'SALARY',
      label: salaryLabel,
      amount: base,
      kind: 'EARNING',
      affectsNet: true,
      sortOrder: 0,
      expenseAccountId: expense,
      liabilityAccountId: null,
    }),
  )
  if (unpaid.gt(0)) {
    lines.push(
      line({
        code: 'UNPAID_LEAVE',
        label: `Unpaid leave (${input.unpaidDays.toFixed(2)} days)`,
        amount: unpaid,
        kind: 'DEDUCTION',
        affectsNet: true,
        sortOrder: 1,
        expenseAccountId: expense,
        liabilityAccountId: null,
      }),
    )
  }

  const overlapWorking = Math.max(1, Math.round(input.workingDays * Number(input.fraction.toFixed(6))))
  const expected = input.otAfter.times(overlapWorking)
  const otHours = Decimal.max(input.workedHours.minus(expected), money(0))
  if (input.workedHours.gt(0) && otHours.gt(0) && input.hoursPerDay.gt(0)) {
    const hourRate = input.wage.div(money(input.workingDays).times(input.hoursPerDay))
    const otPay = hourRate.times(input.otMult).times(otHours)
    if (otPay.gt(0)) {
      lines.push(
        line({
          code: 'OT',
          label: `Overtime × ${otHours.toFixed(2)} h (×${input.otMult.toFixed(2)})`,
          amount: otPay,
          kind: 'EARNING',
          affectsNet: true,
          sortOrder: 2,
          expenseAccountId: expense,
          liabilityAccountId: null,
        }),
      )
    }
  }

  return { base, lines }
}

export function buildStandardLines(input: {
  wageType: WageType
  wageAmount: string
  periodStart: string
  periodEnd: string
  hiredAt: string | null
  leftAt: string | null
  hoursPerDay: string
  workDaysPerWeek: number
  overtimeAfterHoursPerDay: string
  overtimeMultiplier: string
  workedDays: number
  workedHours: string
  unpaidLeaveDays: string
  expenseAccountId: string | null
  rules: SalaryRuleInput[]
}): { skip: string | null; lines: StandardLine[] } {
  const window = employmentWindow(input.periodStart, input.periodEnd, input.hiredAt, input.leftAt)
  if (!window) {
    const leftEarly = input.leftAt && input.leftAt < input.periodStart
    return { skip: leftEarly ? 'Left before this period' : 'Joined after this period', lines: [] }
  }

  const periodDays = window.periodDays
  const fraction = money(window.overlapDays).div(periodDays)
  const workingDays = workingDaysInPeriod(periodDays, input.workDaysPerWeek)
  const wage = money(input.wageAmount)
  const built = wageLines({
    wageType: input.wageType,
    wage,
    fraction,
    overlapDays: window.overlapDays,
    periodDays,
    workingDays,
    hoursPerDay: money(input.hoursPerDay),
    otAfter: money(input.overtimeAfterHoursPerDay),
    otMult: money(input.overtimeMultiplier),
    workedDays: input.workedDays,
    workedHours: money(input.workedHours),
    unpaidDays: money(input.unpaidLeaveDays),
    expenseAccountId: input.expenseAccountId,
  })

  if (input.rules.length === 0) return { skip: null, lines: built.lines }

  const hasBase = input.rules.some((rule) => rule.calc === 'BASE')
  const lines: StandardLine[] = hasBase
    ? []
    : built.lines.filter((row) => row.code !== 'UNPAID_LEAVE' && row.code !== 'OT')
  const rules = [...input.rules].sort((a, b) => a.sortOrder - b.sortOrder)
  for (const rule of rules) {
    let amount = money(0)
    if (rule.calc === 'BASE') amount = built.base
    else if (rule.calc === 'FIXED') amount = money(rule.amount).times(rule.kind === 'DEDUCTION' ? 1 : fraction)
    else amount = built.base.times(money(rule.amount)).div(100)
    if (amount.lte(0)) continue
    const employer = rule.kind === 'EMPLOYER'
    lines.push(
      line({
        code: rule.code,
        label: rule.name,
        amount,
        kind: employer || rule.kind === 'EARNING' ? 'EARNING' : 'DEDUCTION',
        affectsNet: !employer,
        sortOrder: 10 + rule.sortOrder,
        expenseAccountId: rule.expenseAccountId ?? input.expenseAccountId,
        liabilityAccountId: rule.liabilityAccountId,
      }),
    )
  }
  for (const code of ['UNPAID_LEAVE', 'OT']) {
    if (lines.some((row) => row.code === code)) continue
    const found = built.lines.find((row) => row.code === code)
    if (found) lines.push(found)
  }
  return { skip: null, lines }
}

export function slipTotals(lines: Pick<StandardLine, 'kind' | 'amount' | 'affectsNet'>[]): {
  gross: Money
  deductions: Money
  employer: Money
  net: Money
} {
  let gross = money(0)
  let deductions = money(0)
  let employer = money(0)
  for (const row of lines) {
    if (!row.affectsNet) {
      employer = employer.plus(row.amount)
      continue
    }
    if (row.kind === 'DEDUCTION') deductions = deductions.plus(row.amount)
    else gross = gross.plus(row.amount)
  }
  return { gross, deductions, employer, net: Decimal.max(gross.minus(deductions), money(0)) }
}

export function applyAdvances(
  lines: StandardLine[],
  advances: { id: string; label: string; balance: string; installment: string; accountId: string | null }[],
): { lines: StandardLine[]; recoveries: { advanceId: string; amount: Money }[] } {
  const next = [...lines]
  const recoveries: { advanceId: string; amount: Money }[] = []
  let { net } = slipTotals(next)
  let sort = 100
  for (const advance of advances) {
    if (net.lte(0)) break
    const take = Decimal.min(money(advance.installment), money(advance.balance), net)
    if (take.lte(0)) continue
    next.push(
      line({
        code: 'ADVANCE',
        label: advance.label,
        amount: take,
        kind: 'DEDUCTION',
        affectsNet: true,
        sortOrder: sort,
        expenseAccountId: null,
        liabilityAccountId: advance.accountId,
        advanceId: advance.id,
      }),
    )
    sort += 1
    recoveries.push({ advanceId: advance.id, amount: take })
    net = net.minus(take)
  }
  return { lines: next, recoveries }
}

export type JournalDraftLine = {
  accountId: string
  debit: Money
  credit: Money
  description: string
}

export function buildPayrollJournal(input: {
  payMode: PayMode
  payFromAccountId: string | null
  liabilityAccountId: string | null
  slips: {
    name: string
    department: string | null
    expenseAccountId: string | null
    payableAccountId: string | null
    payAccountId: string | null
    payMethod: PayMethod
    lines: {
      code: string
      label: string
      amount: string
      kind: 'EARNING' | 'DEDUCTION'
      affectsNet: boolean
      expenseAccountId: string | null
      liabilityAccountId: string | null
    }[]
  }[]
}): { error: string | null; lines: JournalDraftLine[] } {
  const bucket = new Map<string, JournalDraftLine>()
  const add = (accountId: string | null, debit: Money, credit: Money, description: string) => {
    if (!accountId || (debit.lte(0) && credit.lte(0))) return false
    const key = `${accountId}|${debit.gt(0) ? 'D' : 'C'}|${description}`
    const existing = bucket.get(key)
    if (existing) {
      existing.debit = existing.debit.plus(debit)
      existing.credit = existing.credit.plus(credit)
    } else {
      bucket.set(key, { accountId, debit, credit, description })
    }
    return true
  }

  for (const slip of input.slips) {
    const dept = slip.department ? ` · ${slip.department}` : ''
    const expenseFallback = slip.expenseAccountId
    const liabilityFallback = input.liabilityAccountId || slip.payableAccountId
    let net = money(0)
    for (const row of slip.lines) {
      const amount = money(row.amount)
      if (amount.lte(0)) continue
      if (row.code === 'UNPAID_LEAVE') {
        const account = row.expenseAccountId || expenseFallback
        if (!add(account, money(0), amount, `Payroll unpaid leave${dept}`)) {
          return { error: `Set a wage expense account for ${slip.name}.`, lines: [] }
        }
        net = net.minus(amount)
        continue
      }
      if (!row.affectsNet) {
        const expense = row.expenseAccountId || expenseFallback
        const liability = row.liabilityAccountId || liabilityFallback
        if (!add(expense, amount, money(0), `Payroll employer cost${dept}`)) {
          return { error: `Set a wage expense account for ${slip.name}.`, lines: [] }
        }
        if (!add(liability, money(0), amount, `Payroll employer liability · ${row.label}`)) {
          return { error: `Choose a deduction liability account for ${row.label}.`, lines: [] }
        }
        continue
      }
      if (row.kind === 'EARNING') {
        const account = row.expenseAccountId || expenseFallback
        if (!add(account, amount, money(0), `Payroll wages${dept}`)) {
          return { error: `Set a wage expense account for ${slip.name}.`, lines: [] }
        }
        net = net.plus(amount)
      } else {
        const account = row.liabilityAccountId || liabilityFallback
        if (!add(account, money(0), amount, `Payroll deduction · ${row.label}`)) {
          return { error: `Choose a deduction liability account for ${row.label}.`, lines: [] }
        }
        net = net.minus(amount)
      }
    }
    net = Decimal.max(net, money(0))
    if (net.lte(0)) continue
    const creditAccount =
      input.payMode === 'ACCRUE'
        ? slip.payableAccountId || input.liabilityAccountId || input.payFromAccountId
        : slip.payAccountId || input.payFromAccountId
    const creditLabel =
      input.payMode === 'ACCRUE' ? `Payroll payable · ${slip.name}` : `Payroll pay · ${slip.payMethod} · ${slip.name}${dept}`
    if (!add(creditAccount, money(0), net, creditLabel)) {
      return {
        error:
          input.payMode === 'ACCRUE'
            ? `Set a payable account for ${slip.name}, or a liability account on the run.`
            : `Choose the bank, cash, or mobile account to pay ${slip.name}.`,
        lines: [],
      }
    }
  }

  const lines = [...bucket.values()].filter((row) => row.debit.gt(0) || row.credit.gt(0))
  const debit = lines.reduce((sum, row) => sum.plus(row.debit), money(0))
  const credit = lines.reduce((sum, row) => sum.plus(row.credit), money(0))
  if (debit.lte(0) || !debit.eq(credit)) {
    return { error: 'Payroll journal does not balance.', lines: [] }
  }
  return { error: null, lines }
}

/**
 * Pay accrued wages: debit the same payable each slip credited at post,
 * credit bank / cash / mobile (employee pay account or the run pay-from).
 */
export function buildPayrollSettlementJournal(input: {
  payFromAccountId: string | null
  liabilityAccountId: string | null
  slips: {
    name: string
    department: string | null
    payableAccountId: string | null
    payAccountId: string | null
    payMethod: PayMethod
    net: string
  }[]
}): { error: string | null; lines: JournalDraftLine[] } {
  const bucket = new Map<string, JournalDraftLine>()
  const add = (accountId: string | null, debit: Money, credit: Money, description: string) => {
    if (!accountId || (debit.lte(0) && credit.lte(0))) return false
    const key = `${accountId}|${debit.gt(0) ? 'D' : 'C'}|${description}`
    const existing = bucket.get(key)
    if (existing) {
      existing.debit = existing.debit.plus(debit)
      existing.credit = existing.credit.plus(credit)
    } else {
      bucket.set(key, { accountId, debit, credit, description })
    }
    return true
  }

  for (const slip of input.slips) {
    const net = money(slip.net)
    if (net.lte(0)) continue
    const payable = slip.payableAccountId || input.liabilityAccountId
    const pay = slip.payAccountId || input.payFromAccountId
    const dept = slip.department ? ` · ${slip.department}` : ''
    if (!add(payable, net, money(0), `Pay wages payable · ${slip.name}`)) {
      return {
        error: `Set a payable account for ${slip.name}, or a liability account on the run.`,
        lines: [],
      }
    }
    if (!add(pay, money(0), net, `Settle payroll · ${slip.payMethod} · ${slip.name}${dept}`)) {
      return {
        error: `Choose the bank, cash, or mobile account to pay ${slip.name}.`,
        lines: [],
      }
    }
  }

  const lines = [...bucket.values()].filter((row) => row.debit.gt(0) || row.credit.gt(0))
  const debit = lines.reduce((sum, row) => sum.plus(row.debit), money(0))
  const credit = lines.reduce((sum, row) => sum.plus(row.credit), money(0))
  if (debit.lte(0) || !debit.eq(credit)) {
    return { error: 'Settlement journal does not balance.', lines: [] }
  }
  return { error: null, lines }
}

/** Totals by pay method for the payment batch summary on a run. */
export function paymentSummaryByMethod(
  slips: { payMethod: PayMethod; net: string; included?: boolean }[],
): { method: PayMethod; count: number; net: Money }[] {
  const map = new Map<PayMethod, { count: number; net: Money }>()
  for (const slip of slips) {
    if (slip.included === false) continue
    const net = money(slip.net)
    if (net.lte(0)) continue
    const row = map.get(slip.payMethod) ?? { count: 0, net: money(0) }
    row.count += 1
    row.net = row.net.plus(net)
    map.set(slip.payMethod, row)
  }
  const order: PayMethod[] = ['CASH', 'BANK', 'MOBILE']
  return order
    .filter((method) => map.has(method))
    .map((method) => ({ method, count: map.get(method)!.count, net: map.get(method)!.net }))
}

/** Apply a fixed OT override after lines were built from attendance. */
export function applyOvertimeOverride(lines: StandardLine[], overtimeAmount: string | null): StandardLine[] {
  if (overtimeAmount == null) return lines
  const amount = money(overtimeAmount)
  const without = lines.filter((row) => row.code !== 'OT')
  if (amount.lte(0)) return without
  const template = lines.find((row) => row.code === 'OT')
  const ot: StandardLine = {
    code: 'OT',
    label: template?.label ?? 'Overtime',
    amount,
    kind: 'EARNING',
    affectsNet: true,
    sortOrder: template?.sortOrder ?? 15,
    expenseAccountId: template?.expenseAccountId ?? null,
    liabilityAccountId: null,
    advanceId: null,
  }
  return [...without, ot].sort((a, b) => a.sortOrder - b.sortOrder)
}

/** `monthsPerYear` months of wage for each year of service. 1 = one month per year. */
export function endOfServiceAmount(input: {
  monthlyWage: string
  hiredAt: string | null
  asOf: string
  monthsPerYear: string
}): { years: string; amount: Money } | null {
  if (!input.hiredAt || input.hiredAt > input.asOf) return null
  const days = calendarDaysInclusive(input.hiredAt, input.asOf)
  const years = money(days).div(365)
  const amount = money(input.monthlyWage).times(money(input.monthsPerYear)).times(years)
  return { years: years.toFixed(4), amount }
}
