'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { calendarDate, cuid, moneyString, requiredText } from '@/lib/validation/common'
import { action } from '@/server/action'
import * as assetService from '@/server/services/fixed-asset.service'

export const createFixedAssetCategory = action
  .requires('journal:post')
  .input(
    z.object({
      name: requiredText('Name', 120),
      usefulLifeMonths: z.coerce.number().int().min(1).max(600),
      assetAccountId: cuid,
      accumDepAccountId: cuid,
      expenseAccountId: cuid,
    }),
  )
  .handler(async (ctx, input) => {
    const row = await assetService.createCategory(ctx, input)
    revalidatePath('/accounting/fixed-assets')
    revalidatePath('/accounting/fixed-assets/categories')
    return row
  })

export const createFixedAsset = action
  .requires('journal:post')
  .input(
    z.object({
      categoryId: cuid,
      number: requiredText('Number', 40),
      name: requiredText('Name', 160),
      acquiredOn: calendarDate,
      cost: moneyString,
      salvageValue: moneyString.optional().nullable(),
      usefulLifeMonths: z.coerce.number().int().min(1).max(600).optional().nullable(),
    }),
  )
  .handler(async (ctx, input) => {
    const row = await assetService.createAsset(ctx, input)
    revalidatePath('/accounting/fixed-assets')
    return row
  })

export const runDepreciation = action
  .requires('journal:post')
  .input(z.object({ month: calendarDate }))
  .handler(async (ctx, input) => {
    const result = await assetService.depreciateMonth(ctx, input.month)
    revalidatePath('/accounting/fixed-assets')
    revalidatePath('/journals')
    return result
  })
