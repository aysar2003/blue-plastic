'use server'

import { revalidatePath } from 'next/cache'

import { attendanceIdSchema, attendanceUpsertSchema } from '@/lib/validation/attendance'
import { action } from '@/server/action'
import * as attendanceService from '@/server/services/attendance.service'

function revalidateAttendance() {
  revalidatePath('/employees/attendance')
}

export const upsertAttendance = action
  .requires('hr:attendance')
  .input(attendanceUpsertSchema)
  .handler(async (ctx, input) => {
    const row = await attendanceService.upsert(ctx, input)
    revalidateAttendance()
    return row
  })

export const deleteAttendance = action
  .requires('hr:attendance')
  .input(attendanceIdSchema)
  .handler(async (ctx, input) => {
    await attendanceService.remove(ctx, input.id)
    revalidateAttendance()
    return { id: input.id }
  })
