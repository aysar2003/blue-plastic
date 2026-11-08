import type { Metadata } from 'next'

import { requireOrgContext } from '@/server/auth/context'
import * as onboardingService from '@/server/services/onboarding.service'

import { OnboardingWizard } from './onboarding-wizard'

export const metadata: Metadata = { title: 'Onboarding' }

export default async function OnboardingPage() {
  const ctx = await requireOrgContext()
  const state = await onboardingService.getState(ctx)

  return (
    <OnboardingWizard
      packs={state.packs}
      completed={state.completed}
      packLabel={state.packLabel}
    />
  )
}
