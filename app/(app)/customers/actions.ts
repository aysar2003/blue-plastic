'use server'

import { revalidatePath } from 'next/cache'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import { z } from 'zod'
import {
  bulkSetActiveSchema,
  csvImportSchema,
  customerSchema,
  vendorSchema,
} from '@/lib/validation/master-data'
import { cuid } from '@/lib/validation/common'
import { action } from '@/server/action'
import { requireOrgContext, type OrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import {
  listCustomerFiles,
  readCustomerUploads,
  removeCustomerFile as deleteCustomerFile,
  storeCustomerUploads,
  uploadProblem,
} from '@/server/files/customer-files'
import * as contactService from '@/server/services/contact.service'
import { importContacts } from '@/server/services/import.service'

function revalidateContacts() {
  revalidatePath('/customers')
  revalidatePath('/vendors')
  revalidatePath('/accounts')
  revalidatePath('/reports/trial-balance')
}

/* --- Customers ------------------------------------------------------------ */

export const createCustomer = action
  .requires('customer:create')
  .input(customerSchema)
  .handler(async (ctx, input) => {
    const customer = await contactService.createCustomer(ctx, input)
    revalidateContacts()
    // The label comes back so a picker that opened this dialog can show the new
    // record immediately, without re-reading the list to find out its name.
    return { id: customer.id, displayName: input.displayName }
  })

export const updateCustomer = action
  .requires('customer:update')
  .input(customerSchema.extend({ id: cuid }))
  .handler(async (ctx, input) => {
    const customer = await contactService.updateCustomer(ctx, input)
    revalidateContacts()
    revalidatePath(`/customers/${input.id}`)
    return { id: customer.id }
  })

export const removeCustomerFile = action
  .requires('customer:update')
  .input(z.object({ customerId: cuid, fileId: cuid }))
  .handler(async (ctx, input) => {
    await deleteCustomerFile(ctx, input.customerId, input.fileId)
    revalidateContacts()
    return { id: input.fileId }
  })

export const setCustomersActive = action
  .requires('customer:archive')
  .input(bulkSetActiveSchema)
  .handler(async (ctx, input) => {
    const result = await contactService.setActive(ctx, 'customer', input.ids, input.isActive)
    revalidateContacts()
    return result
  })

/* --- Vendors -------------------------------------------------------------- */

export const createVendor = action
  .requires('vendor:create')
  .input(vendorSchema)
  .handler(async (ctx, input) => {
    const vendor = await contactService.createVendor(ctx, input)
    revalidateContacts()
    return { id: vendor.id, displayName: input.displayName }
  })

export const updateVendor = action
  .requires('vendor:update')
  .input(vendorSchema.extend({ id: cuid }))
  .handler(async (ctx, input) => {
    const vendor = await contactService.updateVendor(ctx, input)
    revalidateContacts()
    revalidatePath(`/vendors/${input.id}`)
    return { id: vendor.id }
  })

export const setVendorsActive = action
  .requires('vendor:archive')
  .input(bulkSetActiveSchema)
  .handler(async (ctx, input) => {
    const result = await contactService.setActive(ctx, 'vendor', input.ids, input.isActive)
    revalidateContacts()
    return result
  })

/* --- Import --------------------------------------------------------------- */

export const previewCustomerImport = action
  .requires('customer:create')
  .input(csvImportSchema)
  .handler((ctx, input) => importContacts(ctx, 'customer', input, { dryRun: true }))

export const runCustomerImport = action
  .requires('customer:create')
  .input(csvImportSchema)
  .handler(async (ctx, input) => {
    const result = await importContacts(ctx, 'customer', input)
    revalidateContacts()
    return result
  })

export const previewVendorImport = action
  .requires('vendor:create')
  .input(csvImportSchema)
  .handler((ctx, input) => importContacts(ctx, 'vendor', input, { dryRun: true }))

export const runVendorImport = action
  .requires('vendor:create')
  .input(csvImportSchema)
  .handler(async (ctx, input) => {
    const result = await importContacts(ctx, 'vendor', input)
    revalidateContacts()
    revalidatePath('/vendors')
    return result
  })

/* --- Form adapters -------------------------------------------------------- */

export async function createCustomerForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const uploads = readCustomerUploads(formData)
  const problem = uploadProblem(uploads, 0)
  if (problem) return { status: 'error', fieldErrors: problem }

  const result = await createCustomer(formValues(formData))
  if (!result.ok || !result.data.id) return toFormState(result, 'Customer created.')
  const stored = await attachUploads('customer:create', result.data.id, uploads)
  if (stored) return { status: 'success', message: `Customer created. ${stored}`, created: { id: result.data.id, label: result.data.displayName } }
  return toFormState(result, 'Customer created.')
}

export async function updateCustomerForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const uploads = readCustomerUploads(formData)
  const values = formValues(formData)
  if ((uploads.photo || uploads.agreements.length > 0) && values.id) {
    try {
      const ctx = await requireOrgContext('customer:update')
      const papers = (await listCustomerFiles(ctx, values.id)).filter((file) => file.kind === 'AGREEMENT').length
      const problem = uploadProblem(uploads, papers)
      if (problem) return { status: 'error', fieldErrors: problem }
    } catch (error) {
      if (isAppError(error)) return { status: 'error', message: error.message }
      throw error
    }
  }

  const result = await updateCustomer(values)
  if (!result.ok || !values.id) return toFormState(result, 'Customer saved.')
  const stored = await attachUploads('customer:update', values.id, uploads)
  if (stored) return { status: 'success', message: `Customer saved. ${stored}` }
  return toFormState(result, 'Customer saved.')
}

/** Stores the photo and papers after the customer row exists. Returns a warning, or null when the files are in. */
async function attachUploads(
  permission: 'customer:create' | 'customer:update',
  customerId: string,
  uploads: ReturnType<typeof readCustomerUploads>,
): Promise<string | null> {
  if (!uploads.photo && uploads.agreements.length === 0) return null
  try {
    const ctx: OrgContext = await requireOrgContext(permission)
    await storeCustomerUploads(ctx, customerId, uploads)
    revalidateContacts()
    return null
  } catch (error) {
    return isAppError(error) ? error.message : 'The papers could not be stored. Open the customer and attach them again.'
  }
}

export async function createVendorForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await createVendor(formValues(formData)), 'Vendor created.')
}

export async function updateVendorForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await updateVendor(formValues(formData)), 'Vendor saved.')
}
