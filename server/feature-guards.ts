import 'server-only'

import type { OrgContext } from '@/server/auth/context'
import { precondition } from '@/server/errors'

/**
 * Settings → Configuration switches are enforced here as well as in the UI, so a
 * hidden button is never the only thing standing between a user and a delete.
 */
export function assertDocumentDeleteAllowed(ctx: OrgContext) {
  if (!ctx.features.allowDocumentDelete) {
    throw precondition('Document delete is turned off in Settings → Configuration.')
  }
}

export function assertJournalDeleteAllowed(ctx: OrgContext) {
  if (!ctx.features.allowJournalDelete) {
    throw precondition('Journal delete is turned off in Settings → Configuration.')
  }
}

export function assertCustomerDeleteAllowed(ctx: OrgContext) {
  if (!ctx.features.allowCustomerDelete) {
    throw precondition('Customer delete is turned off in Settings → Configuration.')
  }
}

export function assertVendorDeleteAllowed(ctx: OrgContext) {
  if (!ctx.features.allowVendorDelete) {
    throw precondition('Vendor delete is turned off in Settings → Configuration.')
  }
}

export function assertItemDeleteAllowed(ctx: OrgContext) {
  if (!ctx.features.allowItemDelete) {
    throw precondition('Item delete is turned off in Settings → Configuration.')
  }
}

export function assertAccountDeleteAllowed(ctx: OrgContext) {
  if (!ctx.features.allowAccountDelete) {
    throw precondition('Account delete is turned off in Settings → Configuration.')
  }
}

/** @deprecated Prefer assertCustomerDeleteAllowed / assertVendorDeleteAllowed. */
export function assertContactDeleteAllowed(ctx: OrgContext) {
  assertCustomerDeleteAllowed(ctx)
  assertVendorDeleteAllowed(ctx)
}
