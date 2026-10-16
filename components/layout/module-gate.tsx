import { redirect } from 'next/navigation'

import { isModuleEnabled, type ModuleFlag } from '@/lib/feature-flags'
import type { OrgContext } from '@/server/auth/context'

/**
 * Server gate for an app folder. When the company was not granted the app (or
 * turned it off), send them home instead of rendering a half-empty screen.
 */
export function enforceModule(ctx: OrgContext, module: ModuleFlag) {
  if (!isModuleEnabled(ctx.features, module)) {
    redirect('/dashboard?app=unavailable')
  }
}
