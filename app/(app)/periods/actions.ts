'use server'

import { revalidatePath } from 'next/cache'

import {
  closeYearSchema,
  ensureFiscalYearSchema,
  periodStatusSchema,
  reopenYearSchema,
} from '@/lib/validation/accounting'
import { action } from '@/server/action'
import * as closeService from '@/server/services/close.service'
import * as periodService from '@/server/services/period.service'

export const setPeriodStatus = action
  .input(periodStatusSchema)
  .handler(async (ctx, input) => {
    // Closing and reopening are different authorities: a bookkeeper who may close
    // the month must not be able to quietly reopen a reported one.
    const permission = input.status === 'CLOSED' ? 'period:close' : 'period:reopen'
    if (!ctx.permissions.has(permission)) {
      const { forbidden } = await import('@/server/errors')
      throw forbidden(`This action requires the "${permission}" permission.`)
    }

    await periodService.setStatus(ctx, input.periodId, input.status)
    revalidatePath('/periods')
    revalidatePath(`/periods/${input.periodId}`)
    revalidatePath('/journals')
    return { id: input.periodId, status: input.status }
  })

export const createFiscalYear = action
  .requires('period:close')
  .input(ensureFiscalYearSchema)
  .handler(async (ctx, input) => {
    const result = await periodService.createFiscalYear(ctx, input.year)
    revalidatePath('/periods')
    return result
  })

/**
 * The year-end close. Gated on `period:close` like a month, because it is the
 * same authority applied to twelve of them at once.
 */
export const closeFiscalYear = action
  .requires('period:close')
  .input(closeYearSchema)
  .handler(async (ctx, input) => {
    const result = await closeService.closeFiscalYear(ctx, input.fiscalYearId)
    revalidatePath('/periods')
    revalidatePath('/journals')
    revalidatePath('/reports/balance-sheet')
    return result
  })

export const reopenFiscalYear = action
  .requires('period:reopen')
  .input(reopenYearSchema)
  .handler(async (ctx, input) => {
    const result = await closeService.reopenFiscalYear(ctx, input.fiscalYearId, input.reason)
    revalidatePath('/periods')
    revalidatePath('/journals')
    revalidatePath('/reports/balance-sheet')
    return result
  })
