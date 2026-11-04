'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { calendarDate } from '@/lib/validation/common'
import { action } from '@/server/action'
import * as fxService from '@/server/services/fx-revaluation.service'

export const runFxRevaluation = action
  .requires('journal:post')
  .input(
    z.object({
      currencyCode: z.string().trim().toUpperCase().length(3),
      newRate: z.string().trim().regex(/^\d{1,12}(\.\d{1,9})?$/, 'Enter a rate'),
      date: calendarDate.optional(),
    }),
  )
  .handler(async (ctx, input) => {
    const result = await fxService.revalueOpenForeign(ctx, input)
    revalidatePath('/accounting/fx-revaluation')
    revalidatePath('/journals')
    return result
  })
