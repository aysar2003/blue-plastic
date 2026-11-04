'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { calendarDate, cuid, optionalText } from '@/lib/validation/common'
import { action } from '@/server/action'
import * as timeService from '@/server/services/project-time.service'

export const createTimeEntry = action
  .requires('project:update')
  .input(
    z.object({
      projectId: cuid,
      taskId: cuid.optional().nullable(),
      workDate: calendarDate,
      hours: z.string().trim().regex(/^\d{1,8}(\.\d{1,4})?$/, 'Enter hours'),
      description: optionalText(500),
      billable: z.coerce.boolean().default(true),
      billableRate: z
        .union([
          z.string().trim().regex(/^\d{1,12}(\.\d{1,4})?$/, 'Enter a rate'),
          z.literal(''),
        ])
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .optional(),
    }),
  )
  .handler(async (ctx, input) => {
    const row = await timeService.create(ctx, input)
    revalidatePath(`/projects/${input.projectId}`)
    revalidatePath(`/projects/${input.projectId}/timesheets`)
    return row
  })

export const deleteTimeEntry = action
  .requires('project:update')
  .input(z.object({ id: cuid, projectId: cuid }))
  .handler(async (ctx, input) => {
    const row = await timeService.remove(ctx, input.id)
    revalidatePath(`/projects/${input.projectId}`)
    revalidatePath(`/projects/${input.projectId}/timesheets`)
    return row
  })
