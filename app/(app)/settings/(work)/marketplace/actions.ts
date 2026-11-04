'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canInstallApp, canUninstallApp, isMarketplaceModule } from '@/lib/erp/marketplace'
import { isModuleEnabled, isModuleGranted } from '@/lib/feature-flags'
import { requireOrgContext } from '@/server/auth/context'
import { validation } from '@/server/errors'
import * as organizationService from '@/server/services/organization.service'

const PATH = '/settings/marketplace'

export async function installApp(formData: FormData) {
  const ctx = await requireOrgContext('org:update')
  const key = String(formData.get('module') ?? '')
  const enabled = String(formData.get('enabled') ?? '') === 'true'
  if (!isMarketplaceModule(key)) throw validation('Unknown app.')
  const flags = ctx.features
  const granted = isModuleGranted(flags, key)
  const on = isModuleEnabled(flags, key)
  const enabledCount = Object.values(flags.modules).filter(Boolean).length
  if (enabled && !canInstallApp(granted, on)) {
    throw validation('Not granted, or already on.')
  }
  if (!enabled && !canUninstallApp(on, enabledCount)) {
    throw validation('Keep at least one app on.')
  }
  await organizationService.updateModuleEnabled(ctx, key, enabled)
  revalidatePath(PATH)
  revalidatePath('/', 'layout')
  redirect(PATH)
}
