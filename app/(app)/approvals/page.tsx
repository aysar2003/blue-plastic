import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { entityTypeLabel } from '@/lib/approval-labels'
import { formatDateTime } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as approvalService from '@/server/services/approval.service'

import { ApprovalDecideButtons } from './decide-buttons'
import { ApprovalPoliciesForm } from './policies-form'

export const metadata: Metadata = { title: 'Approvals' }

export default async function ApprovalsPage() {
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
          . Sales and purchase documents will then wait here until an authorised
          checker posts them (SOX / COSO segregation of duties). Point of Sale
          still posts at the till.
        </Card>
      </>
    )
  }

  await approvalService.ensureDefaultPolicies(ctx)
  const [pending, recent, policies] = await Promise.all([
    approvalService.listPending(ctx),
    approvalService.listRecent(ctx),
    approvalService.listPolicies(ctx),
  ])

  const canConfigure = ctx.permissions.has('org:update')

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Documents waiting for a second person to approve before they hit the ledger. The maker who entered them cannot approve their own work (Owner/Admin may when needed)."
      />

      <Card className="mb-6 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How it works</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Turn on the kinds of work you want to gate (invoices, sales orders, purchase orders, payments, transfers, customer credit…).</li>
          <li>Staff save as usual (not as draft). Matching documents wait here as “Awaiting approval”.</li>
          <li>A checker Approves (posts or opens the document) or Rejects (returns to draft). Use 2–3 levels when more than one person must sign off.</li>
        </ol>
      </Card>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">Waiting ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is waiting for approval.</p>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Submitted by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Decide</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={row.href} className="font-medium text-primary hover:underline">
                        {row.title}
                      </Link>
                      {row.requiredLevels > 1 ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Level {row.currentLevel} of {row.requiredLevels}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entityTypeLabel(row.entityType)}
                    </TableCell>
                    <TableCell className="text-sm">{row.submittedBy.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.amount != null
                        ? formatMoney(row.amount.toString(), row.currencyCode ?? ctx.organization.baseCurrency)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(row.submittedAt, ctx.organization.timeZone)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ApprovalDecideButtons
                        requestId={row.id}
                        isOwn={row.submittedById === ctx.userId}
                        isOwnerOrAdmin={ctx.role === 'OWNER' || ctx.role === 'ADMIN'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      {recent.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold">Recent decisions</h2>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted by</TableHead>
                  <TableHead>Decided</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={row.href} className="text-sm hover:underline">
                        {row.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === 'APPROVED'
                            ? 'success'
                            : row.status === 'REJECTED'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {row.status === 'APPROVED'
                          ? 'Approved'
                          : row.status === 'REJECTED'
                            ? 'Rejected'
                            : 'Cancelled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.submittedBy.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.decidedAt
                        ? formatDateTime(row.decidedAt, ctx.organization.timeZone)
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      ) : null}

      {canConfigure ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Workflows &amp; rules</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Split Approvals by document kind (purchase order vs bill, sales order vs invoice),
            amount band, and steps. First matching enabled rule by priority wins.
            Amount band is min ≤ amount &lt; max. Empty max = no ceiling. Different-person is
            SOX segregation of duties.
          </p>
          <ApprovalPoliciesForm
            policies={policies.map((p) => ({
              id: p.id,
              name: p.name,
              entityType: p.entityType,
              documentKind: p.documentKind,
              enabled: p.enabled,
              minAmount: p.minAmount.toString(),
              maxAmount: p.maxAmount?.toString() ?? null,
              priority: p.priority,
              requireDifferentApprover: p.requireDifferentApprover,
              levels: p.levels,
            }))}
          />
        </section>
      ) : null}
    </>
  )
}
