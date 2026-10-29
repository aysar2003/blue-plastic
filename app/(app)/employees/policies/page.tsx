import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import * as hrPolicyService from '@/server/services/hr-policy.service'
import { PoliciesBoard } from './policies-board'

export const metadata: Metadata = { title: 'HR policies' }

export default async function HrPoliciesPage() {
  const ctx = await requireOrgContext('hr:read')
  const policies = await hrPolicyService.list(ctx)

  return (
    <>
      <PageHeader
        title="Policies"
        description="Company HR policies — leave, attendance, conduct. Optional PDF attachment."
      />
      <PoliciesBoard policies={policies} canManage={ctx.permissions.has('hr:update')} />
    </>
  )
}
