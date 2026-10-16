'use server'

import { revalidatePath } from 'next/cache'

import { reviewAppAccessSchema } from '@/lib/validation/app-access'
import { action } from '@/server/action'
import * as appAccessService from '@/server/services/app-access.service'

export const reviewAppAccessRequest = action
  .requires('org:update')
  .input(reviewAppAccessSchema)
  .handler(async (ctx, input) => {
    const row = await appAccessService.review(ctx, input)
    revalidatePath('/databases')
    revalidatePath('/settings/features')
    revalidatePath('/', 'layout')
    return row
  })
