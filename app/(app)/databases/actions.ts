'use server'

import { revalidatePath } from 'next/cache'

import {
  attachSubCompanySchema,
  createCompanySchema,
  deleteCompanySchema,
} from '@/lib/validation/company'
import { action } from '@/server/action'
import * as companyService from '@/server/services/company.service'

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
