'use server'

import { revalidatePath } from 'next/cache'

import {
  hrBudgetCreateSchema,
  hrBudgetIdSchema,
  hrBudgetMonthUpdateSchema,
} from '@/lib/validation/hr-suite'
import { action } from '@/server/action'
import * as hrBudgetService from '@/server/services/hr-budget.service'

function revalidateBudget(id?: string) {
  revalidatePath('/employees/budget')
  if (id) revalidatePath(`/employees/budget/${id}`)
}

export const createHrBudget = action
  .requires('hr:update')
  .input(hrBudgetCreateSchema)
  .handler(async (ctx, input) => {
    const row = await hrBudgetService.create(ctx, input)
    revalidateBudget(row.id)
    return row
  })

export const updateHrBudgetMonth = action
  .requires('hr:update')
  .input(hrBudgetMonthUpdateSchema)
  .handler(async (ctx, input) => {
    const row = await hrBudgetService.updateMonth(ctx, input)
    revalidateBudget(input.budgetId)
    return row
  })

export const deleteHrBudget = action
  .requires('hr:update')
  .input(hrBudgetIdSchema)
  .handler(async (ctx, input) => {
    await hrBudgetService.remove(ctx, input.id)
    revalidateBudget()
    return { id: input.id }
  })
