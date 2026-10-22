import { enforceModule } from '@/components/layout/module-gate'
import { requireOrgContext } from '@/server/auth/context'
import * as approvalService from '@/server/services/approval.service'

import { ApprovalsNav } from './approvals-nav'

export default async function ApprovalsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext()
  enforceModule(ctx, 'approvals')
  const enabled = approvalService.approvalsEnabled(ctx)
  const counts = enabled
    ? await approvalService.counts(ctx)
    : { pending: 0, approved: 0 }

  return (
    <>
      <ApprovalsNav
        pending={counts.pending}
        approved={counts.approved}
        canConfigure={ctx.permissions.has('org:update')}
      />
      {children}
    </>
  )
}
