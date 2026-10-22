import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/date'
import type { ApprovalTrailCycle } from '@/lib/approval-trail'

function statusBadge(status: ApprovalTrailCycle['status']) {
  if (status === 'APPROVED') return <Badge variant="success">Approved</Badge>
  if (status === 'REJECTED') return <Badge variant="destructive">Rejected</Badge>
  if (status === 'CANCELLED') return <Badge variant="secondary">Cancelled</Badge>
  return <Badge variant="warning">Awaiting approval</Badge>
}

function waitingLine(cycle: ApprovalTrailCycle) {
  if (cycle.status !== 'PENDING') return null
  if (cycle.waitingAnyone) {
    return 'Waiting for anyone with Approve permission.'
  }
  if (cycle.waitingFor.length === 0) {
    return 'Waiting for an Owner or Admin to decide.'
  }
  return `Waiting for ${cycle.waitingFor.join(', ')}.`
}

export function ApprovalTrail({
  cycles,
  timeZone,
  createdBy,
  createdAt,
}: {
  cycles: ApprovalTrailCycle[]
  timeZone: string
  createdBy?: string | null
  createdAt?: Date | null
}) {
  if (cycles.length === 0) return null

  return (
    <section className="mt-8 rounded-xl border border-border bg-card p-3 print:hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Approval</h2>
        <Link
          href="/approvals"
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          Open Pending
        </Link>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Who created this paper, who submitted it, who already signed, and who it is waiting for.
      </p>
      {createdBy ? (
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">Created by </span>
          <span className="font-medium">{createdBy}</span>
          {createdAt ? (
            <span className="text-muted-foreground">
              {' '}
              · {formatDateTime(createdAt, timeZone)}
            </span>
          ) : null}
        </p>
      ) : null}
      <ol className="mt-3 space-y-3">
        {cycles.map((cycle) => (
          <li
            key={cycle.id}
            className={
              createdBy
                ? 'border-t border-border pt-3'
                : 'border-t border-border pt-3 first:border-t-0 first:pt-0'
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(cycle.status)}
              {cycle.requiredLevels > 1 ? (
                <span className="text-xs text-muted-foreground">
                  Level {cycle.currentLevel} of {cycle.requiredLevels}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-sm">
              <span className="text-muted-foreground">Submitted by </span>
              <span className="font-medium">{cycle.submittedBy}</span>
              <span className="text-muted-foreground">
                {' '}
                · {formatDateTime(cycle.submittedAt, timeZone)}
              </span>
            </p>
            {cycle.decisions.map((step) => (
              <p key={`${cycle.id}-${step.level}-${step.decision}`} className="mt-1 text-sm">
                <span className="text-muted-foreground">
                  {step.decision === 'APPROVED' ? 'Approved by ' : 'Rejected by '}
                </span>
                <span className="font-medium">{step.by}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {formatDateTime(step.at, timeZone)}
                </span>
                {cycle.requiredLevels > 1 ? (
                  <span className="text-muted-foreground"> · level {step.level}</span>
                ) : null}
                {step.note ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{step.note}</span>
                ) : null}
              </p>
            ))}
            {cycle.status === 'PENDING' ? (
              <p className="mt-1 text-sm font-medium text-foreground">{waitingLine(cycle)}</p>
            ) : null}
            {cycle.status === 'REJECTED' ? (
              <p className="mt-1 text-xs text-muted-foreground">Returned to draft.</p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
