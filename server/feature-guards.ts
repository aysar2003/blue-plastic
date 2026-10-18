import 'server-only'

import {
  documentKindForPath,
  isDocumentKindEnabled,
  isModuleEnabled,
  moduleForPath,
  type ModuleFlag,
} from '@/lib/feature-flags'
import type { OrgContext } from '@/server/auth/context'
import { precondition } from '@/server/errors'

/**
 * Settings → Configuration switches are enforced here as well as in the UI, so a
 * hidden button is never the only thing standing between a user and a delete.
 */

/** Refuse a page or action when this company was not granted the app, or turned it off. */
export function assertModuleEnabled(ctx: OrgContext, moduleKey: ModuleFlag | string) {
  if (!isModuleEnabled(ctx.features, moduleKey)) {
    throw precondition('This app is not available for this company.')
  }
}

/** Map a URL to its app and refuse when that app is off. */
export function assertPathModuleEnabled(ctx: OrgContext, pathname: string) {
  const module = moduleForPath(pathname)
  if (module) assertModuleEnabled(ctx, module)
  const kind = documentKindForPath(pathname)
  if (kind && !isDocumentKindEnabled(ctx.features, kind.family, kind.kind)) {
    throw precondition('This document type is turned off in Settings → Apps & features.')
  }
}

/** Refuse when a nested document kind is off under Apps & features. */
export function assertDocumentKindEnabled(
  ctx: OrgContext,
  family: 'sales' | 'purchases' | 'inventory',
  kind: string,
) {
  if (!isDocumentKindEnabled(ctx.features, family, kind)) {
    throw precondition('This document type is turned off in Settings → Apps & features.')
  }
}
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

export function assertTaxEnabled(ctx: OrgContext) {
  if (!ctx.features.enableTax) {
    throw precondition('Tax is turned off in Settings → Tax for this company.')
  }
}

export function isTaxEnabled(ctx: OrgContext): boolean {
  return ctx.features.enableTax !== false
}

/** @deprecated Prefer assertCustomerDeleteAllowed / assertVendorDeleteAllowed. */
export function assertContactDeleteAllowed(ctx: OrgContext) {
  assertCustomerDeleteAllowed(ctx)
  assertVendorDeleteAllowed(ctx)
}
