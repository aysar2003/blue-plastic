'use server'

import { revalidatePath } from 'next/cache'

import {
  attendanceDeviceCreateSchema,
  attendanceDeviceIdSchema,
  attendanceDeviceUpdateSchema,
  attendanceDeviceUserIdSchema,
  attendanceDeviceUserSchema,
} from '@/lib/validation/hr-suite'
import { action } from '@/server/action'
import * as deviceService from '@/server/services/attendance-device.service'

function revalidateDevices() {
  revalidatePath('/employees/attendance')
  revalidatePath('/employees/attendance/devices')
}

export const createAttendanceDevice = action
  .requires('hr:attendance')
  .input(attendanceDeviceCreateSchema)
  .handler(async (ctx, input) => {
    const row = await deviceService.createDevice(ctx, input)
    revalidateDevices()
    return row
  })

export const updateAttendanceDevice = action
  .requires('hr:attendance')
  .input(attendanceDeviceUpdateSchema)
  .handler(async (ctx, input) => {
    const { id, ...rest } = input
    const row = await deviceService.updateDevice(ctx, id, rest)
    revalidateDevices()
    return row
  })

export const rotateAttendanceDeviceToken = action
  .requires('hr:attendance')
  .input(attendanceDeviceIdSchema)
  .handler(async (ctx, input) => {
    const row = await deviceService.rotateDeviceToken(ctx, input.id)
    revalidateDevices()
    return row
  })

export const deleteAttendanceDevice = action
  .requires('hr:attendance')
  .input(attendanceDeviceIdSchema)
  .handler(async (ctx, input) => {
    await deviceService.removeDevice(ctx, input.id)
    revalidateDevices()
    return { id: input.id }
  })

export const mapAttendanceDeviceUser = action
  .requires('hr:attendance')
  .input(attendanceDeviceUserSchema)
  .handler(async (ctx, input) => {
    const row = await deviceService.mapDeviceUser(ctx, input)
    revalidateDevices()
    return row
  })

export const unmapAttendanceDeviceUser = action
  .requires('hr:attendance')
  .input(attendanceDeviceUserIdSchema)
  .handler(async (ctx, input) => {
    await deviceService.unmapDeviceUser(ctx, input.id)
    revalidateDevices()
    return { id: input.id }
  })
