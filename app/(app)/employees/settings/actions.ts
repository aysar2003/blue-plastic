'use server'

import { revalidatePath } from 'next/cache'

import { hrSettingsUpdateSchema } from '@/lib/validation/hr-suite'
import { action } from '@/server/action'
import * as hrSettingsService from '@/server/services/hr-settings.service'

export const updateHrSettings = action
  .requires('hr:update')
  .input(hrSettingsUpdateSchema)
  .handler(async (ctx, input) => {
    const row = await hrSettingsService.update(ctx, input)
    revalidatePath('/employees/settings')
    revalidatePath('/employees/payroll')
    revalidatePath('/employees/guide')
    return row
  })
