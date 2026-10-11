import { z } from 'zod'

import { cuid } from '@/lib/validation/common'

export const CALENDAR_KINDS = ['meeting', 'appointment', 'reminder'] as const
export type CalendarKind = (typeof CALENDAR_KINDS)[number]

export const CALENDAR_KIND_LABELS: Record<CalendarKind, string> = {
  meeting: 'Meeting',
  appointment: 'Appointment',
  reminder: 'Reminder',
}

/** Common reminder lead times, in minutes before the start. */
export const REMINDER_OPTIONS = [
  { value: '', label: 'No reminder' },
  { value: '0', label: 'At start time' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
] as const

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm')

const optionalId = z
  .union([cuid, z.literal('')])
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

export const calendarEventInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  location: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  kind: z.enum(CALENDAR_KINDS).default('meeting'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  startTime: timeOfDay.default('09:00'),
  endTime: timeOfDay.default('10:00'),
  allDay: z
    .union([z.boolean(), z.literal('on'), z.literal('true'), z.literal('1'), z.literal('')])
    .optional()
    .transform((value) => value === true || value === 'on' || value === 'true' || value === '1'),
  reminderMinutes: z
    .union([z.number().int(), z.string()])
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null || value === '') return null
      const n = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(n) || n < 0) return null
      return Math.min(Math.trunc(n), 60 * 24 * 14)
    }),
  customerId: optionalId,
  vendorId: optionalId,
})

export const calendarEventCreateSchema = calendarEventInputSchema

export const calendarEventUpdateSchema = calendarEventInputSchema.extend({
  id: cuid,
})

export const calendarEventIdSchema = z.object({ id: cuid })

export type CalendarEventInput = z.infer<typeof calendarEventInputSchema>
