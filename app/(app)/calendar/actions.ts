'use server'

import { revalidatePath } from 'next/cache'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import {
  calendarEventCreateSchema,
  calendarEventIdSchema,
  calendarEventUpdateSchema,
} from '@/lib/validation/calendar'
import { action } from '@/server/action'
import * as calendarService from '@/server/services/calendar.service'

function revalidateCalendar() {
  revalidatePath('/calendar')
  revalidatePath('/dashboard')
}

export const createEvent = action
  .requires('calendar:create')
  .input(calendarEventCreateSchema)
  .handler(async (ctx, input) => {
    const row = await calendarService.create(ctx, input)
    revalidateCalendar()
    return { id: row.id, name: row.title }
  })

export const updateEvent = action
  .requires('calendar:update')
  .input(calendarEventUpdateSchema)
  .handler(async (ctx, input) => {
    const { id, ...rest } = input
    const row = await calendarService.update(ctx, id, rest)
    revalidateCalendar()
    return { id: row.id, name: row.title }
  })

export const deleteEvent = action
  .requires('calendar:delete')
  .input(calendarEventIdSchema)
  .handler(async (ctx, input) => {
    await calendarService.remove(ctx, input.id)
    revalidateCalendar()
    return { id: input.id }
  })

export const dismissCalendarReminder = action
  .requires('calendar:read')
  .input(calendarEventIdSchema)
  .handler(async (ctx, input) => {
    await calendarService.dismissReminder(ctx, input.id)
    revalidateCalendar()
    return { id: input.id }
  })

export async function createEventForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await createEvent(formValues(formData)), 'Saved on the calendar.')
}

export async function updateEventForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await updateEvent(formValues(formData)), 'Event updated.')
}
