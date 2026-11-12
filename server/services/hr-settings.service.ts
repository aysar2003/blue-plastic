import 'server-only'

import {
  defaultWorkWeekdays,
  parseOvertimeRules,
  parseWorkWeekdays,
  type OvertimeTier,
} from '@/lib/payroll-standard'
import { money } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

const DEFAULTS = {
  hoursPerDay: '8',
  workDaysPerWeek: 6,
  overtimeAfterHoursPerDay: '8',
  overtimeMultiplier: '1.5',
  timezoneNote: null as string | null,
}

export async function get(ctx: OrgContext) {
  let row = await db.hrSettings.findUnique({ where: { orgId: ctx.orgId } })
  if (!row) {
    row = await db.hrSettings.create({
      data: {
        orgId: ctx.orgId,
        hoursPerDay: money(DEFAULTS.hoursPerDay),
        workDaysPerWeek: DEFAULTS.workDaysPerWeek,
        overtimeAfterHoursPerDay: money(DEFAULTS.overtimeAfterHoursPerDay),
        overtimeMultiplier: money(DEFAULTS.overtimeMultiplier),
        overtimeRules: [{ afterHours: '12', multiplier: '2' }],
        workWeekdays: defaultWorkWeekdays(DEFAULTS.workDaysPerWeek),
        timezoneNote: DEFAULTS.timezoneNote,
      },
    })
  }
  return {
    id: row.id,
    hoursPerDay: row.hoursPerDay.toFixed(4),
    workDaysPerWeek: row.workDaysPerWeek,
    overtimeAfterHoursPerDay: row.overtimeAfterHoursPerDay.toFixed(4),
    overtimeMultiplier: row.overtimeMultiplier.toFixed(4),
    overtimeRules: parseOvertimeRules(row.overtimeRules) ?? [],
    workWeekdays: parseWorkWeekdays(row.workWeekdays, row.workDaysPerWeek),
    timezoneNote: row.timezoneNote,
  }
}

export async function update(
  ctx: OrgContext,
  input: {
    hoursPerDay: string
    workDaysPerWeek: number
    overtimeAfterHoursPerDay: string
    overtimeMultiplier: string
    overtimeRules?: OvertimeTier[] | null
    workWeekdays?: number[] | null
    timezoneNote?: string | null
  },
) {
  const existing = await get(ctx)
  const weekdays =
    input.workWeekdays != null && input.workWeekdays.length > 0
      ? parseWorkWeekdays(input.workWeekdays, input.workDaysPerWeek)
      : defaultWorkWeekdays(input.workDaysPerWeek)
  const row = await db.hrSettings.update({
    where: { id: existing.id },
    data: {
      hoursPerDay: money(input.hoursPerDay),
      workDaysPerWeek: input.workDaysPerWeek,
      overtimeAfterHoursPerDay: money(input.overtimeAfterHoursPerDay),
      overtimeMultiplier: money(input.overtimeMultiplier),
      overtimeRules: input.overtimeRules?.length ? input.overtimeRules : [],
      workWeekdays: weekdays,
      timezoneNote: input.timezoneNote ?? null,
    },
  })
  return {
    id: row.id,
    hoursPerDay: row.hoursPerDay.toFixed(4),
    workDaysPerWeek: row.workDaysPerWeek,
    overtimeAfterHoursPerDay: row.overtimeAfterHoursPerDay.toFixed(4),
    overtimeMultiplier: row.overtimeMultiplier.toFixed(4),
    overtimeRules: parseOvertimeRules(row.overtimeRules) ?? [],
    workWeekdays: parseWorkWeekdays(row.workWeekdays, row.workDaysPerWeek),
    timezoneNote: row.timezoneNote,
  }
}
