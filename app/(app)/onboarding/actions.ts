'use server'

import { revalidatePath } from 'next/cache'

import {
  completeOnboardingSchema,
  skipOnboardingSchema,
  toggleChecklistItemSchema,
} from '@/lib/validation/onboarding'
import { action } from '@/server/action'
import * as onboardingService from '@/server/services/onboarding.service'
import * as organizationService from '@/server/services/organization.service'
import * as setupHealService from '@/server/services/setup-heal.service'
import * as taxService from '@/server/services/tax.service'
import { z } from 'zod'

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
    revalidatePath('/dashboard')
    return result
  })

export const applyRetailShopProfile = action.handler(async (ctx) => {
  const result = await onboardingService.applyRetailShopProfile(ctx)
  revalidatePath('/settings/setup')
  revalidatePath('/settings/features')
  revalidatePath('/onboarding')
  revalidatePath('/help/coverage')
  revalidatePath('/', 'layout')
  return result
})

export const ensureLocalizationFromCountry = action.handler(async (ctx) => {
  const result = await onboardingService.ensureLocalizationFromCountry(ctx)
  revalidatePath('/settings/setup')
  revalidatePath('/settings/organization')
  revalidatePath('/', 'layout')
  return result
})

export const seedLocalizationTax = action
  .input(z.object({ enableTax: z.boolean().optional() }).optional())
  .handler(async (ctx, input) => {
    if (input?.enableTax) {
      await organizationService.updateEnableTax(ctx, true)
    }
    const result = await taxService.seedLocalizationTax(ctx)
    revalidatePath('/settings/setup')
    revalidatePath('/settings/tax')
    revalidatePath('/', 'layout')
    return result
  })

/** Wave G: pack PAYE slabs → Standard salary structure TAX rule. */
export const applyLocalizationPaye = action
  .input(z.object({ force: z.boolean().optional() }).optional())
  .handler(async (ctx, input) => {
    const payroll = await import('@/server/services/payroll-standard.service')
    const result = await payroll.applyLocalizationPaye(ctx, { force: input?.force })
    revalidatePath('/settings/setup')
    revalidatePath('/employees/payroll')
    revalidatePath('/employees/structures')
    return result
  })

export const healMissingItemSkus = action.handler(async (ctx) => {
  const result = await setupHealService.healMissingItemSkus(ctx)
  revalidatePath('/settings/setup')
  revalidatePath('/items')
  return result
})

export const healMissingReorderPoints = action.handler(async (ctx) => {
  const result = await setupHealService.healMissingReorderPoints(ctx)
  revalidatePath('/settings/setup')
  revalidatePath('/items')
  revalidatePath('/inventory/replenish')
  return result
})

export const healCustomerCountriesFromOrg = action.handler(async (ctx) => {
  const result = await setupHealService.healCustomerCountriesFromOrg(ctx)
  revalidatePath('/settings/setup')
  revalidatePath('/customers')
  return result
})

export const healOrgCountryFromPack = action.handler(async (ctx) => {
  const result = await setupHealService.healOrgCountryFromPack(ctx)
  revalidatePath('/settings/setup')
  revalidatePath('/settings/organization')
  revalidatePath('/', 'layout')
  return result
})

export const healItemTaxFromPack = action.handler(async (ctx) => {
  const result = await setupHealService.healItemTaxFromPack(ctx)
  revalidatePath('/settings/setup')
  revalidatePath('/items')
  revalidatePath('/settings/tax')
  return result
})
