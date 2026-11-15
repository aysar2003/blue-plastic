'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  budgetCopySchema,
  budgetCreateSchema,
  budgetIdSchema,
  budgetImportSchema,
  budgetLineIdSchema,
  budgetLineUpsertSchema,
} from '@/lib/validation/budget'
import { action } from '@/server/action'
import * as budgetService from '@/server/services/budget.service'

function revalidateBudget(id?: string) {
  revalidatePath('/accounting/budgets')
  revalidatePath('/reports/budget-vs-actual')
  if (id) revalidatePath(`/accounting/budgets/${id}`)
}

export const createBudget = action
  .requires('report:read')
  .input(budgetCreateSchema)
  .handler(async (ctx, input) => {
    const row = await budgetService.create(ctx, input)
    revalidateBudget(row.id)
    redirect(`/accounting/budgets/${row.id}`)
  })

export const upsertBudgetLine = action
  .requires('report:read')
  .input(budgetLineUpsertSchema)
  .handler(async (ctx, input) => {
    const row = await budgetService.upsertLine(ctx, {
      ...input,
      trackingCategoryId: input.trackingCategoryId || null,
    })
    revalidateBudget(input.budgetId)
    return row
  })

export const deleteBudgetLine = action
  .requires('report:read')
  .input(budgetLineIdSchema)
  .handler(async (ctx, input) => {
    const row = await budgetService.deleteLine(ctx, input.lineId)
    if (row) revalidateBudget(row.budgetId)
    return row
  })

export const approveBudget = action
  .requires('report:read')
  .input(budgetIdSchema)
  .handler(async (ctx, input) => {
    const row = await budgetService.approve(ctx, input.id)
    revalidateBudget(row.id)
    return row
  })

export const reviseBudget = action
  .requires('report:read')
  .input(budgetIdSchema)
  .handler(async (ctx, input) => {
    const row = await budgetService.revise(ctx, input.id)
    revalidateBudget(input.id)
    revalidateBudget(row.id)
    redirect(`/accounting/budgets/${row.id}`)
  })

export const copyBudget = action
  .requires('report:read')
  .input(budgetCopySchema)
  .handler(async (ctx, input) => {
    const row = await budgetService.copyBudget(ctx, input)
    revalidateBudget(row.id)
    redirect(`/accounting/budgets/${row.id}`)
  })

export const collapseBudgetToFirstMonth = action
  .requires('report:read')
  .input(budgetIdSchema)
  .handler(async (ctx, input) => {
    const row = await budgetService.collapseBudgetToFirstMonth(ctx, input.id)
    revalidateBudget(row.id)
    return row
  })

export const spreadBudgetEvenly = action
  .requires('report:read')
  .input(budgetIdSchema)
  .handler(async (ctx, input) => {
    const row = await budgetService.spreadBudgetEvenly(ctx, input.id)
    revalidateBudget(row.id)
    return row
  })

export const importBudgetCsv = action
  .requires('report:read')
  .input(budgetImportSchema)
  .handler(async (ctx, input) => {
    const result = await budgetService.importCsv(ctx, input)
    if (result.committed) revalidateBudget(input.budgetId)
    return result
  })
