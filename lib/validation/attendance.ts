import { z } from 'zod'

import { calendarDate, cuid, moneyString, optionalText } from '@/lib/validation/common'

const optionalInstant = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

export const attendanceUpsertSchema = z.object({
  employeeId: cuid,
  date: calendarDate,
  checkIn: optionalInstant,
  checkOut: optionalInstant,
  workedHours: moneyString.optional().nullable(),
  note: optionalText(1000),
})

export const attendanceIdSchema = z.object({ id: cuid })
