import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MARKETPLACE_LEGAL } from '@/lib/erp/marketplace'
import {
  MODULE_FLAG_LABELS,
  MODULE_FLAGS,
  isModuleEnabled,
  isModuleGranted,
} from '@/lib/feature-flags'
import { getPack, suggestedAddOnsForPack } from '@/lib/packs'
import { requireOrgContext } from '@/server/auth/context'
import * as onboardingService from '@/server/services/onboarding.service'

import { installApp } from './actions'

export const metadata: Metadata = { title: 'Marketplace' }

export default async function MarketplacePage() {
  const ctx = await requireOrgContext('org:read')
  const flags = ctx.features
  const canUpdate = ctx.permissions.has('org:update')
  const state = await onboardingService.getState(ctx)
  const pack = state.installedPackId ? getPack(state.installedPackId) : null
  const suggested = suggestedAddOnsForPack(state.installedPackId)
  const suggestedSet = new Set(suggested)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">App marketplace</h2>
        <p className="mt-1 text-sm text-muted-foreground">{MARKETPLACE_LEGAL}</p>
        {pack ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Your workspace is <span className="font-medium text-foreground">{pack.label}</span>.
            Add apps below without changing that desk. Switching industry packs in onboarding
            replaces apps.
          </p>
        ) : null}
      </div>

      {suggested.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Suggested for {pack?.label ?? 'your workspace'}</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {suggested.map((key) => {
              const granted = isModuleGranted(flags, key)
              const on = isModuleEnabled(flags, key)
              const meta = MODULE_FLAG_LABELS[key]
              return (
                <li key={key}>
                  <Card className="flex h-full flex-col justify-between gap-2 border-foreground/20 p-4">
                    <div>
                      <p className="font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{meta.hint}</p>
                      <p className="mt-1 text-xs">
                        {on ? 'Installed' : granted ? 'Available' : 'Not granted — request in Apps & features'}
                      </p>
                    </div>
                    {canUpdate && granted ? (
                      <form action={installApp}>
                        <input type="hidden" name="module" value={key} />
                        <input type="hidden" name="enabled" value={on ? 'false' : 'true'} />
                        <Button type="submit" size="sm" variant={on ? 'outline' : 'default'}>
                          {on ? 'Turn off' : 'Install'}
                        </Button>
                      </form>
                    ) : null}
                  </Card>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">All apps</h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {MODULE_FLAGS.filter((key) => !suggestedSet.has(key)).map((key) => {
            const granted = isModuleGranted(flags, key)
            const on = isModuleEnabled(flags, key)
            const meta = MODULE_FLAG_LABELS[key]
            return (
              <li key={key}>
                <Card className="flex h-full flex-col justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.hint}</p>
                    <p className="mt-1 text-xs">
                      {on ? 'Installed' : granted ? 'Available' : 'Not granted'}
                    </p>
                  </div>
                  {canUpdate && granted ? (
                    <form action={installApp}>
                      <input type="hidden" name="module" value={key} />
                      <input type="hidden" name="enabled" value={on ? 'false' : 'true'} />
                      <Button type="submit" size="sm" variant={on ? 'outline' : 'default'}>
                        {on ? 'Turn off' : 'Install'}
                      </Button>
                    </form>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
