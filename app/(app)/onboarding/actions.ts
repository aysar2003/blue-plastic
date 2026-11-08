'use server'

import { revalidatePath } from 'next/cache'

import {
  completeOnboardingSchema,
  skipOnboardingSchema,
  toggleChecklistItemSchema,
} from '@/lib/validation/onboarding'
import { action } from '@/server/action'
import * as onboardingService from '@/server/services/onboarding.service'

export const completeOnboarding = action
  .input(completeOnboardingSchema)
  .handler(async (ctx, input) => {
    const result = await onboardingService.complete(ctx, input)
    revalidatePath('/onboarding')
    revalidatePath('/settings')
    revalidatePath('/settings/setup')
    revalidatePath('/help/coverage')
    revalidatePath('/')
    return result
  })

export const skipOnboarding = action
  .input(skipOnboardingSchema)
  .handler(async (ctx) => {
    const result = await onboardingService.skip(ctx)
    revalidatePath('/onboarding')
    revalidatePath('/settings/setup')
    revalidatePath('/')
    return result
  })

export const reopenOnboarding = action.handler(async (ctx) => {
  const result = await onboardingService.reopen(ctx)
  revalidatePath('/onboarding')
  revalidatePath('/settings/setup')
  return result
})

export const toggleSetupChecklistItem = action
  .input(toggleChecklistItemSchema)
  .handler(async (ctx, input) => {
    const result = await onboardingService.toggleChecklistItem(ctx, input)
    revalidatePath('/settings/setup')
    revalidatePath('/onboarding')
    return result
  })
