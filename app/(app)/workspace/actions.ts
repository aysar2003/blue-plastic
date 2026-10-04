'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { bookmarkSchema } from '@/lib/validation/banking'
import { action } from '@/server/action'
import * as workspace from '@/server/services/workspace.service'

export const saveBookmark = action
  .requires('org:read')
  .input(bookmarkSchema)
  .handler(async (ctx, input) => {
    const result = await workspace.saveBookmark(ctx, input)
    revalidatePath('/dashboard')
    return result
  })

export const removeBookmark = action
  .requires('org:read')
  .input(z.object({ id: z.string().min(1) }))
  .handler(async (ctx, input) => {
    const result = await workspace.removeBookmark(ctx, input.id)
    revalidatePath('/dashboard')
    return result
  })

export const saveReportNote = action
  .requires('report:read')
  .input(z.object({ reportKey: z.enum(['profit-loss', 'balance-sheet']), body: z.string().max(2000) }))
  .handler(async (ctx, input) => {
    const result = await workspace.saveReportNote(ctx, input.reportKey, input.body)
    revalidatePath('/reports/profit-loss')
    revalidatePath('/reports/side-by-side')
    return result
  })
