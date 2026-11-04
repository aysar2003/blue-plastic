'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { calendarDate, cuid, moneyString, optionalText } from '@/lib/validation/common'
import { action } from '@/server/action'
import * as equityService from '@/server/services/equity-contribution.service'

export const postEquityContribution = action
  .requires('journal:post')
  .input(
    z.object({
      bankAccountId: cuid,
      amount: moneyString,
      date: calendarDate,
      memo: optionalText(200),
    }),
  )
  .handler(async (ctx, input) => {
    const result = await equityService.postContribution(ctx, input)
    revalidatePath('/accounting/equity-contribution')
    revalidatePath('/journals')
    return result
  })
