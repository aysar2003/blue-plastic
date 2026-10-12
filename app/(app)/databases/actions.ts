'use server'

import { revalidatePath } from 'next/cache'

import {
  attachSubCompanySchema,
  createCompanySchema,
  deleteCompanySchema,
  switchCompanySchema,
  updateCompanyLimitsSchema,
} from '@/lib/validation/company'
import { reviewSignupRequestSchema } from '@/lib/validation/signup-request'
import { action } from '@/server/action'
import * as companyService from '@/server/services/company.service'
import * as registerService from '@/server/services/register.service'

/** Create another separate company (database) on this instance. */
export const createCompany = action
  .input(createCompanySchema)
  .handler(async (ctx, input) => {
    const org = await companyService.createCompany(ctx, input)
    revalidatePath('/databases')
    revalidatePath('/reports/companies')
    revalidatePath('/', 'layout')
    return org
  })

/** Attach an existing company under a main company. */
export const attachSubCompany = action
  .input(attachSubCompanySchema)
  .handler(async (ctx, input) => {
    const result = await companyService.attachSubCompany(ctx, input)
    revalidatePath('/databases')
    revalidatePath('/reports/companies')
    revalidatePath('/', 'layout')
    return result
  })

/** Permanently remove a company. The client switches session when it was current. */
export const deleteCompany = action
  .input(deleteCompanySchema)
  .handler(async (ctx, input) => {
    const result = await companyService.deleteCompany(ctx, input)
    revalidatePath('/databases')
    revalidatePath('/reports/companies')
    revalidatePath('/', 'layout')
    return result
  })

/** Approve or reject a public /register request (system owner). */
export const reviewSignupRequest = action
  .input(reviewSignupRequestSchema)
  .handler(async (ctx, input) => {
    const result = await registerService.reviewSignupRequest(ctx, input)
    revalidatePath('/databases')
    revalidatePath('/reports/companies')
    revalidatePath('/', 'layout')
    return result
  })

/** Lock, rent end date, and max users for a company (system owner). */
export const updateCompanyLimits = action
  .input(updateCompanyLimitsSchema)
  .handler(async (ctx, input) => {
    const result = await companyService.updateCompanyLimits(ctx, input)
    revalidatePath('/databases')
    revalidatePath('/', 'layout')
    return result
  })

/** Confirm the signed-in user may open this company before switching session. */
export const openCompany = action
  .input(switchCompanySchema)
  .handler(async (ctx, input) => {
    return companyService.assertCanOpenCompany(ctx, input.orgId)
  })
