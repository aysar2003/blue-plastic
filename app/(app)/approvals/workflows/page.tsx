import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'
import * as approvalService from '@/server/services/approval.service'

import { ApprovalPoliciesForm } from '../policies-form'
import { ApprovalReadyPacks } from '../ready-packs'

export const metadata: Metadata = { title: 'Approval workflows' }

export default async function ApprovalWorkflowsPage() {
  const ctx = await requireOrgContext('org:update')

  if (!approvalService.approvalsEnabled(ctx)) {
    return (
      <>
        <PageHeader title="Workflows" description="Turn on approvals before you set rules." />
        <Card className="p-6 text-sm text-muted-foreground">
          Enable <strong>Require approval before posting</strong> under{' '}
          <Link href="/settings/features" className="text-primary underline-offset-2 hover:underline">
            Settings → Apps &amp; features
          </Link>
          .
        </Card>
      </>
    )
  }

  const [policies, members] = await Promise.all([
    approvalService.listPolicies(ctx),
    approvalService.listAssignableApprovers(ctx),
  ])

  const packCounts = new Map<string, number>()
  for (const policy of policies) {
    if (policy.source === 'READY' && policy.packKey && policy.enabled) {
      packCounts.set(policy.packKey, (packCounts.get(policy.packKey) ?? 0) + 1)
    }
  }
  const activePackKey =
    [...packCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return (
    <>
      <PageHeader
        title="Workflows"
        description="Use a ready-made set like QuickBooks or Odoo, or build your own rule and assign the people who may approve it."
      />

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold">Ready-made rules</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Installing a set turns off catch-all “every document in this family” rules so quotations
          and estimates no longer wait unless you add them yourself.
        </p>
        <ApprovalReadyPacks activePackKey={activePackKey} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Your rules</h2>
        <ApprovalPoliciesForm
          members={members}
          policies={policies.map((policy) => ({
            id: policy.id,
            name: policy.name,
            entityType: policy.entityType,
            documentKind: policy.documentKind,
            enabled: policy.enabled,
            minAmount: policy.minAmount.toString(),
            maxAmount: policy.maxAmount?.toString() ?? null,
            priority: policy.priority,
            requireDifferentApprover: policy.requireDifferentApprover,
            levels: policy.levels,
            source: policy.source,
            approverIds: policy.approvers.map((row) => row.userId),
          }))}
        />
      </section>
    </>
  )
}
