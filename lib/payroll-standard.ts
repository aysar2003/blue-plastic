import { Decimal } from 'decimal.js'

import { money, type Money } from '@/lib/money'

export type PayMethod = 'CASH' | 'BANK' | 'MOBILE'
export type PayMode = 'IMMEDIATE' | 'ACCRUE'
export type WageType = 'MONTHLY' | 'DAILY' | 'HOURLY'
export type RuleKind = 'EARNING' | 'DEDUCTION' | 'EMPLOYER'
export type RuleCalc = 'BASE' | 'FIXED' | 'PERCENT' | 'SLABS'

/** Progressive bracket: tax the slice from the previous upTo up to this upTo at `rate` %. */
export type SalarySlab = { upTo: string | null; rate: string }

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
  slabs?: SalarySlab[] | null
  expenseAccountId: string | null
  liabilityAccountId: string | null
  sortOrder: number
}

export function parseSlabs(raw: unknown): SalarySlab[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: SalarySlab[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const record = row as { upTo?: unknown; rate?: unknown }
    const rate =
      record.rate == null || record.rate === ''
        ? null
        : typeof record.rate === 'number'
          ? String(record.rate)
          : String(record.rate).trim()
    if (rate == null || !Number.isFinite(Number(rate))) continue
    let upTo: string | null = null
    if (record.upTo != null && record.upTo !== '' && record.upTo !== '*') {
      upTo =
        typeof record.upTo === 'number' ? String(record.upTo) : String(record.upTo).trim()
      if (!Number.isFinite(Number(upTo))) continue
    }
    out.push({ upTo, rate })
  }
  return out.length ? out : null
}

/** Marginal progressive amount on `base` using ordered brackets. */
export function amountFromSlabs(base: Money, slabs: SalarySlab[]): Money {
  if (base.lte(0) || slabs.length === 0) return money(0)
  const sorted = [...slabs].sort((a, b) => {
    if (a.upTo == null) return 1
    if (b.upTo == null) return -1
    return money(a.upTo).cmp(money(b.upTo))
  })
  let remaining = base
  let prevCap = money(0)
  let total = money(0)
  for (const bracket of sorted) {
    if (remaining.lte(0)) break
    const cap = bracket.upTo == null ? null : money(bracket.upTo)
    const width = cap == null ? remaining : Decimal.max(cap.minus(prevCap), money(0))
    const slice = Decimal.min(remaining, width)
    if (slice.gt(0)) {
      total = total.plus(slice.times(money(bracket.rate)).div(100))
      remaining = remaining.minus(slice)
    }
    if (cap != null) prevCap = Decimal.max(prevCap, cap)
  }
  return total
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

/** Default Mon–Fri / Mon–Sat / all from workDaysPerWeek. */
export function defaultWorkWeekdays(workDaysPerWeek: number): number[] {
  const n = Math.min(7, Math.max(1, workDaysPerWeek))
  if (n >= 7) return [0, 1, 2, 3, 4, 5, 6]
  if (n <= 5) return [1, 2, 3, 4, 5]
  return [1, 2, 3, 4, 5, 6]
}

export function parseWorkWeekdays(raw: unknown, workDaysPerWeek: number): number[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const days = [
      ...new Set(
        raw
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
      ),
    ].sort((a, b) => a - b)
    if (days.length) return days
  }
  return defaultWorkWeekdays(workDaysPerWeek)
}

/** Count calendar dates in [from, to] whose weekday is in `weekdays` (UTC date). */
export function countWorkdaysInRange(from: string, to: string, weekdays: number[]): number {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  const set = new Set(weekdays)
  let count = 0
  for (let t = start; t <= end; t += 86_400_000) {
    if (set.has(new Date(t).getUTCDay())) count += 1
  }
  return Math.max(count, 1)
}

export type OvertimeTier = { afterHours: string; multiplier: string }

export function parseOvertimeRules(raw: unknown): OvertimeTier[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: OvertimeTier[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const record = row as { afterHours?: unknown; multiplier?: unknown }
    const after =
      record.afterHours == null || record.afterHours === ''
        ? null
        : String(record.afterHours).trim()
    const mult =
      record.multiplier == null || record.multiplier === ''
        ? null
        : String(record.multiplier).trim()
    if (after == null || mult == null) continue
    if (!Number.isFinite(Number(after)) || !Number.isFinite(Number(mult))) continue
    out.push({ afterHours: after, multiplier: mult })
  }
  return out.length ? out : null
}

export function resolveOvertimeTiers(input: {
  overtimeAfterHoursPerDay: string
  overtimeMultiplier: string
  overtimeRules?: OvertimeTier[] | null
}): OvertimeTier[] {
  const extra = input.overtimeRules?.length ? input.overtimeRules : []
  const first: OvertimeTier = {
    afterHours: input.overtimeAfterHoursPerDay,
    multiplier: input.overtimeMultiplier,
  }
  const merged = [first, ...extra.filter((row) => Number(row.afterHours) > Number(first.afterHours))]
  return merged.sort((a, b) => money(a.afterHours).cmp(money(b.afterHours)))
}

/** Split OT hours across progressive after-hour bands (QBO-style 1.5x then 2x). */
export function payOvertimeHours(
  hourRate: Money,
  otHours: Money,
  workedDays: number,
  tiers: OvertimeTier[],
): { amount: Money; label: string } {
  if (otHours.lte(0) || tiers.length === 0 || hourRate.lte(0)) {
    return { amount: money(0), label: '' }
  }
  const days = Math.max(workedDays, 1)
  let remaining = otHours
  let amount = money(0)
  const parts: string[] = []
  for (let i = 0; i < tiers.length; i++) {
    if (remaining.lte(0)) break
    const mult = money(tiers[i]!.multiplier)
    const after = money(tiers[i]!.afterHours)
    const next = i + 1 < tiers.length ? money(tiers[i + 1]!.afterHours) : null
    const band =
      next == null ? remaining : Decimal.min(remaining, Decimal.max(next.minus(after).times(days), money(0)))
    if (band.lte(0)) continue
    amount = amount.plus(hourRate.times(mult).times(band))
    parts.push(`${band.toFixed(2)}h ×${mult.toFixed(2)}`)
    remaining = remaining.minus(band)
  }
  if (remaining.gt(0)) {
    const mult = money(tiers[tiers.length - 1]!.multiplier)
    amount = amount.plus(hourRate.times(mult).times(remaining))
    parts.push(`${remaining.toFixed(2)}h ×${mult.toFixed(2)}`)
  }
  return {
    amount,
    label: parts.length === 1 ? `Overtime × ${parts[0]}` : `Overtime (${parts.join(', ')})`,
  }
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
  otTiers: OvertimeTier[]
  workedDays: number
  workedHours: Money
  unpaidDays: Money
  expenseAccountId: string | null
}): { base: Money; lines: StandardLine[] } {
  const lines: StandardLine[] = []
  const expense = input.expenseAccountId
  const firstAfter = money(input.otTiers[0]?.afterHours ?? '8')

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
    const regularCap = firstAfter.times(Math.max(input.workedDays, 1))
    const regularHours = Decimal.min(payableHours, regularCap)
    const otHours = Decimal.max(payableHours.minus(regularHours), money(0))
    const regularPay = input.wage.times(regularHours)
    const ot = payOvertimeHours(input.wage, otHours, input.workedDays, input.otTiers)
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
    if (ot.amount.gt(0)) {
      lines.push(
        line({
          code: 'OT',
          label: ot.label,
          amount: ot.amount,
          kind: 'EARNING',
          affectsNet: true,
          sortOrder: 1,
          expenseAccountId: expense,
          liabilityAccountId: null,
        }),
      )
    }
    return { base: regularPay.plus(ot.amount), lines }
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
  const expected = firstAfter.times(overlapWorking)
  const otHours = Decimal.max(input.workedHours.minus(expected), money(0))
  if (input.workedHours.gt(0) && otHours.gt(0) && input.hoursPerDay.gt(0)) {
    const hourRate = input.wage.div(money(input.workingDays).times(input.hoursPerDay))
    const ot = payOvertimeHours(hourRate, otHours, overlapWorking, input.otTiers)
    if (ot.amount.gt(0)) {
      lines.push(
        line({
          code: 'OT',
          label: ot.label,
          amount: ot.amount,
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
  workWeekdays?: number[] | null
  overtimeAfterHoursPerDay: string
  overtimeMultiplier: string
  overtimeRules?: OvertimeTier[] | null
  workedDays: number
  workedHours: string
  unpaidLeaveDays: string
  /** When attendance has days in period, prefer that for monthly OT baseline. */
  attendanceWorkingDays?: number | null
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
  const weekdays = parseWorkWeekdays(input.workWeekdays, input.workDaysPerWeek)
  const calendarWorking = countWorkdaysInRange(window.start, window.end, weekdays)
  const workingDays =
    input.attendanceWorkingDays != null && input.attendanceWorkingDays > 0
      ? input.attendanceWorkingDays
      : calendarWorking
  const wage = money(input.wageAmount)
  const otTiers = resolveOvertimeTiers({
    overtimeAfterHoursPerDay: input.overtimeAfterHoursPerDay,
    overtimeMultiplier: input.overtimeMultiplier,
    overtimeRules: input.overtimeRules,
  })
  const built = wageLines({
    wageType: input.wageType,
    wage,
    fraction,
    overlapDays: window.overlapDays,
    periodDays,
    workingDays,
    hoursPerDay: money(input.hoursPerDay),
    otTiers,
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
    else if (rule.calc === 'SLABS') {
      amount = rule.slabs?.length ? amountFromSlabs(built.base, rule.slabs) : money(0)
    } else amount = built.base.times(money(rule.amount)).div(100)
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
  trackingCategoryId: string | null
}

export function buildPayrollJournal(input: {
  payMode: PayMode
  payFromAccountId: string | null
  liabilityAccountId: string | null
  slips: {
    name: string
    department: string | null
    trackingCategoryId?: string | null
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
  const add = (
    accountId: string | null,
    debit: Money,
    credit: Money,
    description: string,
    trackingCategoryId: string | null = null,
  ) => {
    if (!accountId || (debit.lte(0) && credit.lte(0))) return false
    const track = trackingCategoryId ?? ''
    const key = `${accountId}|${debit.gt(0) ? 'D' : 'C'}|${description}|${track}`
    const existing = bucket.get(key)
    if (existing) {
      existing.debit = existing.debit.plus(debit)
      existing.credit = existing.credit.plus(credit)
    } else {
      bucket.set(key, { accountId, debit, credit, description, trackingCategoryId })
    }
    return true
  }

  for (const slip of input.slips) {
    const dept = slip.department ? ` · ${slip.department}` : ''
    const track = slip.trackingCategoryId ?? null
    const expenseFallback = slip.expenseAccountId
    const liabilityFallback = input.liabilityAccountId || slip.payableAccountId
    let net = money(0)
    for (const row of slip.lines) {
      const amount = money(row.amount)
      if (amount.lte(0)) continue
      if (row.code === 'UNPAID_LEAVE') {
        const account = row.expenseAccountId || expenseFallback
        if (!add(account, money(0), amount, `Payroll unpaid leave${dept}`, track)) {
          return { error: `Set a wage expense account for ${slip.name}.`, lines: [] }
        }
        net = net.minus(amount)
        continue
      }
      if (!row.affectsNet) {
        const expense = row.expenseAccountId || expenseFallback
        const liability = row.liabilityAccountId || liabilityFallback
        if (!add(expense, amount, money(0), `Payroll employer cost${dept}`, track)) {
          return { error: `Set a wage expense account for ${slip.name}.`, lines: [] }
        }
        if (!add(liability, money(0), amount, `Payroll employer liability · ${row.label}`, track)) {
          return { error: `Choose a deduction liability account for ${row.label}.`, lines: [] }
        }
        continue
      }
      if (row.kind === 'EARNING') {
        const account = row.expenseAccountId || expenseFallback
        if (!add(account, amount, money(0), `Payroll wages${dept}`, track)) {
          return { error: `Set a wage expense account for ${slip.name}.`, lines: [] }
        }
        net = net.plus(amount)
      } else {
        const account = row.liabilityAccountId || liabilityFallback
        if (!add(account, money(0), amount, `Payroll deduction · ${row.label}`, track)) {
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
    if (!add(creditAccount, money(0), net, creditLabel, track)) {
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
    trackingCategoryId?: string | null
    payableAccountId: string | null
    payAccountId: string | null
    payMethod: PayMethod
    net: string
  }[]
}): { error: string | null; lines: JournalDraftLine[] } {
  const bucket = new Map<string, JournalDraftLine>()
  const add = (
    accountId: string | null,
    debit: Money,
    credit: Money,
    description: string,
    trackingCategoryId: string | null = null,
  ) => {
    if (!accountId || (debit.lte(0) && credit.lte(0))) return false
    const track = trackingCategoryId ?? ''
    const key = `${accountId}|${debit.gt(0) ? 'D' : 'C'}|${description}|${track}`
    const existing = bucket.get(key)
    if (existing) {
      existing.debit = existing.debit.plus(debit)
      existing.credit = existing.credit.plus(credit)
    } else {
      bucket.set(key, { accountId, debit, credit, description, trackingCategoryId })
    }
    return true
  }

  for (const slip of input.slips) {
    const net = money(slip.net)
    if (net.lte(0)) continue
    const payable = slip.payableAccountId || input.liabilityAccountId
    const pay = slip.payAccountId || input.payFromAccountId
    const dept = slip.department ? ` · ${slip.department}` : ''
    const track = slip.trackingCategoryId ?? null
    if (!add(payable, net, money(0), `Pay wages payable · ${slip.name}`, track)) {
      return {
        error: `Set a payable account for ${slip.name}, or a liability account on the run.`,
        lines: [],
      }
    }
    if (!add(pay, money(0), net, `Settle payroll · ${slip.payMethod} · ${slip.name}${dept}`, track)) {
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
