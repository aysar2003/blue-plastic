'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import { formatAccessDeniedMessage } from '@/lib/access-denied'
import { isNavigationError } from '@/lib/db-error'
import { portalLoginUrl } from '@/lib/portal-login'
import { generateTemporaryPassword } from '@/lib/temporary-password'
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
import { isAppError, validation } from '@/server/errors'
import {
  listCustomerFiles,
  readCustomerUploads,
  removeCustomerFile as deleteCustomerFile,
  storeCustomerUploads,
  uploadProblem,
} from '@/server/files/customer-files'
import {
  assertCustomerDeleteAllowed,
  assertVendorDeleteAllowed,
} from '@/server/feature-guards'
import * as contactService from '@/server/services/contact.service'
import { importContacts } from '@/server/services/import.service'
import * as lifecycle from '@/server/services/master-data-lifecycle'
import * as portalService from '@/server/services/portal.service'

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
    if (input.inviteToPortal && !input.email) {
      throw validation('Email is required to invite to the portal.')
    }
    const customer = await contactService.createCustomer(ctx, input)
    let portalLogin: string | undefined
    let portalEmail: string | undefined
    let temporaryPassword: string | undefined
    if (
      input.inviteToPortal &&
      input.email &&
      ctx.features.enableCustomerPortal &&
      ctx.permissions.has('portal:manage')
    ) {
      temporaryPassword = generateTemporaryPassword()
      const invite = await portalService.invitePortalUser(ctx, {
        customerId: customer.id,
        name: input.displayName,
        email: input.email,
        inviteMode: 'password',
        temporaryPassword,
      })
      const h = await headers()
      const host = h.get('x-forwarded-host') ?? h.get('host')
      const proto = h.get('x-forwarded-proto') ?? 'http'
      const origin = host ? `${proto}://${host}` : null
      portalLogin = portalLoginUrl(invite.orgId, origin)
      portalEmail = invite.email
      revalidatePath('/customers/portal-users')
    }
    revalidateContacts()
    // The label comes back so a picker that opened this dialog can show the new
    // record immediately, without re-reading the list to find out its name.
    return {
      id: customer.id,
      displayName: input.displayName,
      portalLoginUrl: portalLogin,
      portalEmail,
      temporaryPassword,
      /** @deprecated same as portalLoginUrl for older toast copy */
      inviteUrl: portalLogin,
    }
  })

export const updateCustomer = action
  .requires('customer:update')
  .input(customerSchema.extend({ id: cuid }))
  .handler(async (ctx, input) => {
    const customer = await contactService.updateCustomer(ctx, input)
    let portalLogin: string | undefined
    let portalEmail: string | undefined
    let temporaryPassword: string | undefined
    if (
      input.inviteToPortal &&
      input.email &&
      ctx.features.enableCustomerPortal &&
      ctx.permissions.has('portal:manage')
    ) {
      temporaryPassword = generateTemporaryPassword()
      const invite = await portalService.invitePortalUser(ctx, {
        customerId: customer.id,
        name: input.displayName,
        email: input.email,
        inviteMode: 'password',
        temporaryPassword,
      })
      const h = await headers()
      const host = h.get('x-forwarded-host') ?? h.get('host')
      const proto = h.get('x-forwarded-proto') ?? 'http'
      const origin = host ? `${proto}://${host}` : null
      portalLogin = portalLoginUrl(invite.orgId, origin)
      portalEmail = invite.email
      revalidatePath('/customers/portal-users')
    }
    revalidateContacts()
    revalidatePath(`/customers/${input.id}`)
    return {
      id: customer.id,
      portalLoginUrl: portalLogin,
      portalEmail,
      temporaryPassword,
      inviteUrl: portalLogin,
    }
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

/**
 * Hard-delete a customer with no transactions. If they have history, merge them
 * into another customer instead.
 */
export const deleteCustomer = action
  .requires('customer:delete')
  .input(z.object({ id: cuid }))
  .handler(async (ctx, input) => {
    assertCustomerDeleteAllowed(ctx)
    const result = await lifecycle.purgeCustomer(ctx, input.id)
    revalidateContacts()
    return result
  })

/** Fold every transaction from absorbId into keepId; absorb is removed. */
export const mergeCustomers = action
  .requires('customer:delete')
  .input(z.object({ keepId: cuid, absorbId: cuid }))
  .handler(async (ctx, input) => {
    assertCustomerDeleteAllowed(ctx)
    const result = await lifecycle.mergeCustomers(ctx, input)
    revalidateContacts()
    revalidatePath(`/customers/${input.keepId}`)
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

/**
 * Hard-delete a vendor with no transactions. If they have history, merge them
 * into another vendor instead.
 */
export const deleteVendor = action
  .requires('vendor:delete')
  .input(z.object({ id: cuid }))
  .handler(async (ctx, input) => {
    assertVendorDeleteAllowed(ctx)
    const result = await lifecycle.purgeVendor(ctx, input.id)
    revalidateContacts()
    return result
  })

export const mergeVendors = action
  .requires('vendor:delete')
  .input(z.object({ keepId: cuid, absorbId: cuid }))
  .handler(async (ctx, input) => {
    assertVendorDeleteAllowed(ctx)
    const result = await lifecycle.mergeVendors(ctx, input)
    revalidateContacts()
    revalidatePath(`/vendors/${input.keepId}`)
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
  const portal = portalInviteFields(result.data)
  const stored = await attachUploads('customer:create', result.data.id, uploads)
  const message = portal.portalLoginUrl
    ? 'Customer created. Portal login details are ready to copy.'
    : 'Customer created.'
  if (!stored) {
    return {
      status: 'success',
      message,
      created: { id: result.data.id, label: result.data.displayName },
      ...portal,
    }
  }
  return {
    ...papersState(stored, message, { id: result.data.id, label: result.data.displayName }),
    ...portal,
  }
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
      if (isNavigationError(error)) throw error
      if (isAppError(error)) {
        return {
          status: 'error',
          code: error.code,
          message: error.code === 'FORBIDDEN' ? formatAccessDeniedMessage() : error.message,
        }
      }
      throw error
    }
  }

  const result = await updateCustomer(values)
  if (!result.ok || !values.id) return toFormState(result, 'Customer saved.')
  const portal = portalInviteFields(result.data)
  const stored = await attachUploads('customer:update', values.id, uploads)
  const message = portal.portalLoginUrl
    ? 'Customer saved. Portal login details are ready to copy.'
    : 'Customer saved.'
  if (!stored) return { status: 'success', message, ...portal }
  return { ...papersState(stored, message), ...portal }
}

function portalInviteFields(data: {
  portalLoginUrl?: string
  portalEmail?: string
  temporaryPassword?: string
  inviteUrl?: string
}): Pick<FormState, 'portalLoginUrl' | 'portalEmail' | 'temporaryPassword' | 'inviteUrl'> {
  return {
    portalLoginUrl: data.portalLoginUrl,
    portalEmail: data.portalEmail,
    temporaryPassword: data.temporaryPassword,
    inviteUrl: data.inviteUrl ?? data.portalLoginUrl,
  }
}

type PaperWarning = { message: string; code?: string }

function papersState(stored: PaperWarning | null, saved: string, created?: FormState['created']): FormState {
  if (!stored) return { status: 'success', message: saved, created }
  if (stored.code === 'FORBIDDEN') return { status: 'error', code: 'FORBIDDEN', message: stored.message }
  return { status: 'success', message: `${saved} ${stored.message}`, created }
}

/** Stores the photo and papers after the customer row exists. Returns a warning, or null when the files are in. */
async function attachUploads(
  permission: 'customer:create' | 'customer:update',
  customerId: string,
  uploads: ReturnType<typeof readCustomerUploads>,
): Promise<PaperWarning | null> {
  if (!uploads.photo && uploads.agreements.length === 0) return null
  try {
    const ctx: OrgContext = await requireOrgContext(permission)
    await storeCustomerUploads(ctx, customerId, uploads)
    revalidateContacts()
    return null
  } catch (error) {
    if (isNavigationError(error)) throw error
    if (!isAppError(error)) {
      return { message: 'The papers could not be stored. Open the customer and attach them again.' }
    }
    return {
      code: error.code,
      message: error.code === 'FORBIDDEN' ? formatAccessDeniedMessage() : error.message,
    }
  }
}

export async function createVendorForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await createVendor(formValues(formData)), 'Vendor created.')
}

export async function updateVendorForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await updateVendor(formValues(formData)), 'Vendor saved.')
}
