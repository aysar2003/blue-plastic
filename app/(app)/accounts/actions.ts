'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import { chartImportSchema } from '@/lib/validation/banking'
import {
  accountArchiveSchema,
  accountCreateSchema,
  accountUpdateSchema,
} from '@/lib/validation/accounting'
import { action } from '@/server/action'
import * as accountService from '@/server/services/account.service'

function revalidateChart() {
  revalidatePath('/accounts')
  revalidatePath('/journals')
  revalidatePath('/reports/trial-balance')
}

export const importChartForm = action
  .requires('account:create')
  .input(chartImportSchema)
  .handler(async (ctx, input) => {
    const result = await accountService.importChart(ctx, input.csv)
    revalidateChart()
    return result
  })

export const createAccount = action
  .requires('account:create')
  .input(accountCreateSchema)
  .handler(async (ctx, input) => {
    const account = await accountService.create(ctx, input)
    revalidateChart()
    return { id: account.id }
  })

export const updateAccount = action
  .requires('account:update')
  .input(accountUpdateSchema)
  .handler(async (ctx, input) => {
    const account = await accountService.update(ctx, input)
    revalidateChart()
    return { id: account.id }
  })

export const setAccountActive = action
  .requires('account:archive')
  .input(accountArchiveSchema)
  .handler(async (ctx, input) => {
    await accountService.setActive(ctx, input.id, input.isActive)
    revalidateChart()
    return { id: input.id }
  })

export const installDefaultChart = action
  .requires('account:create')
  .input(z.object({}).optional())
  .handler(async (ctx) => {
    const result = await accountService.installDefaultChart(ctx)
    revalidateChart()
    return result
  })

/* --- form adapters ------------------------------------------------------- */

export async function createAccountForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await createAccount(formValues(formData)), 'Account created.')
}

export async function updateAccountForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await updateAccount(formValues(formData)), 'Account saved.')
}
