import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPack } from '@/lib/packs'
import { can } from '@/server/auth/permissions'
import { requireOrgContext } from '@/server/auth/context'
import * as onboardingService from '@/server/services/onboarding.service'

import { SetupChecklistClient } from './setup-checklist-client'

export const metadata: Metadata = { title: 'Setup checklist' }

export default async function SettingsSetupPage() {
  const ctx = await requireOrgContext('org:read')
  const state = await onboardingService.getState(ctx)
  const pack = state.installedPackId ? getPack(state.installedPackId) : null
  const canEdit = can(ctx.role, 'org:update') || ctx.isSystemOwner

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <PageHeader
        title="Setup checklist"
        description="Finish the first steps for this company’s institution pack."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {pack ? pack.label : 'No institution pack yet'}
          </CardTitle>
          <CardDescription>
            {pack
              ? pack.blurb
              : 'Run onboarding to choose an institution, or skip and configure apps manually.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Onboarding status:{' '}
            {state.completed
              ? `done${state.completedAt ? ` · ${state.completedAt.slice(0, 10)}` : ''}`
              : 'not finished'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/onboarding" className="underline underline-offset-4">
              {state.completed ? 'Re-run institution wizard' : 'Open onboarding'}
            </Link>
            <Link href="/settings/features" className="underline underline-offset-4">
              Apps & features
            </Link>
            <Link href="/settings/marketplace" className="underline underline-offset-4">
              Marketplace
            </Link>
            <Link href="/help/coverage" className="underline underline-offset-4">
              Coverage
            </Link>
          </div>
        </CardContent>
      </Card>

      {pack ? (
        <SetupChecklistClient
          items={pack.setupChecklist.map((item) => ({ ...item }))}
          doneIds={state.checklistDone}
          canEdit={canEdit}
        />
      ) : null}
    </div>
  )
}
