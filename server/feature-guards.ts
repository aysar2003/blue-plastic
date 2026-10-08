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

export function assertContactDeleteAllowed(ctx: OrgContext) {
  if (!ctx.features.allowContactDelete) {
    throw precondition('Contact delete is turned off in Settings → Configuration.')
  }
}
