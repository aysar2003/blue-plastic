import { addMonths, type CalendarDate } from '@/lib/date'
import { Decimal } from '@/lib/money'

export type ScheduleLineDraft = {
  dueDate: CalendarDate
  principalDue: string
  interestDue: string
}

/** Level principal + monthly interest on remaining balance (lite amortization). */
export function generateLoanSchedule(
  principal: Decimal.Value,
  annualRate: Decimal.Value,
  termMonths: number,
  startDate: CalendarDate,
): ScheduleLineDraft[] {
  const p = new Decimal(principal)
  const months = Math.max(1, Math.min(termMonths, 600))
  const monthlyRate = new Decimal(annualRate).div(12).div(100)
  const principalSlice = p.div(months).toDecimalPlaces(4)
  let balance = p
  const lines: ScheduleLineDraft[] = []
  let due = startDate
  for (let i = 0; i < months; i += 1) {
    due = i === 0 ? startDate : addMonths(due, 1)
    const interest = balance.times(monthlyRate).toDecimalPlaces(4)
    const principalDue = i === months - 1 ? balance.toDecimalPlaces(4) : principalSlice
    balance = balance.minus(principalDue).toDecimalPlaces(4)
    lines.push({
      dueDate: due,
      principalDue: principalDue.toFixed(4),
      interestDue: interest.toFixed(4),
    })
  }
  return lines
}

export function scheduleLineTotal(line: { principalDue: string; interestDue: string }): string {
  return new Decimal(line.principalDue).plus(line.interestDue).toFixed(4)
}