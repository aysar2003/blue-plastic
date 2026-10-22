import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardCheckIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { TableToolbar } from '@/components/data/table-toolbar'
import { Card } from '@/components/ui/card'
import { isFamilyWideKindRule } from '@/lib/approval-templates'
import { requireOrgContext } from '@/server/auth/context'
import * as approvalService from '@/server/services/approval.service'
import { trailsFor } from '@/server/services/audit.service'

import { ApprovalRequestTable } from './request-table'
import { toApprovalRow, withCreatedBy } from './to-row'

export const metadata: Metadata = { title: 'Pending approvals' }

export default async function ApprovalsPendingPage() {
  const ctx = await requireOrgContext('org:read')
  const enabled = approvalService.approvalsEnabled(ctx)

  if (!enabled) {
    return (
      <>
        <PageHeader
          title="Approvals"
          description="Maker-checker posting is switched off for this company."
        />
        <Card className="p-6 text-sm text-muted-foreground">
          Turn on <strong>Require approval before posting</strong> under{' '}
          <Link href="/settings/features" className="text-primary underline-offset-2 hover:underline">
            Settings → Apps &amp; features
          </Link>
          . Then choose a ready-made workflow or build your own under Workflows.
        </Card>
      </>
    )
  }

  await approvalService.ensureDefaultPolicies(ctx)
  const [pending, policies] = await Promise.all([
    approvalService.listPending(ctx),
    ctx.permissions.has('org:update') ? approvalService.listPolicies(ctx) : Promise.resolve([]),
  ])
  const trails = await trailsFor(ctx, pending.map((row) => row.entityId))
  const rows = withCreatedBy(
    pending.map((row) => toApprovalRow(ctx, row)),
    trails,
  )
  const catchAllOn = policies.some(
    (policy) => policy.enabled && isFamilyWideKindRule(policy),
  )

  return (
    <>
      <PageHeader
        title="Pending"
        description="Documents waiting for a checker. Open View, Edit, or Print on the paper itself, then Approve or Reject."
        actions={<TableToolbar />}
      />

      {catchAllOn ? (
        <Card className="mb-4 p-3 text-xs text-muted-foreground">
          Catch-all rules are on, so every document in a family waits here (including quotations).
          Switch to a ready-made set under{' '}
          <Link href="/approvals/workflows" className="text-primary underline-offset-2 hover:underline">
            Workflows
          </Link>{' '}
          to gate invoices, bills, and payments only — the QuickBooks / Odoo pattern.
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheckIcon}
          title="Nothing is waiting"
          description="When a gated invoice, bill, payment, or journal is saved, it lands here until an assigned checker posts it."
        />
      ) : (
        <ApprovalRequestTable
          rows={rows}
          timeZone={ctx.organization.timeZone}
          baseCurrency={ctx.organization.baseCurrency}
          mode="pending"
        />
      )}
    </>
  )
}
