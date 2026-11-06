import Link from 'next/link'
import { AlertTriangleIcon, CheckCircle2Icon, CircleAlertIcon } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import type { CloseChecklist } from '@/server/accounting/close-checklist'

const ICON = {
  ok: CheckCircle2Icon,
  warning: CircleAlertIcon,
  blocked: AlertTriangleIcon,
} as const

const TONE = {
  ok: 'text-success',
  warning: 'text-warning',
  blocked: 'text-destructive',
} as const

const SEVERITY_LABEL = {
  ok: 'OK',
  warning: 'Warning — close still allowed',
  blocked: 'Blocked — must fix before close',
} as const

/**
 * The checks are listed in severity order rather than in the order they were
 * run, because the one that matters is the one that is wrong.
 *
 * Warning and blocked rows show a How to fix line so the bookkeeper is not left
 * with only a link and a colour.
 */
export function CloseChecklistCard({
  checklist,
  label,
  action,
}: {
  checklist: CloseChecklist
  label: string
  action?: React.ReactNode
}) {
  const rank = { blocked: 0, warning: 1, ok: 2 } as const
  const checks = [...checklist.checks].sort((a, b) => rank[a.severity] - rank[b.severity])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Before closing {label}</CardTitle>
        <CardDescription>
          {formatDate(checklist.from)} — {formatDate(checklist.to)} ·{' '}
          {checklist.blocked
            ? 'The books disagree with themselves. Fix the red items before closing anything.'
            : checklist.warnings === 0
              ? 'Everything is in order.'
              : `${checklist.warnings} thing${checklist.warnings === 1 ? '' : 's'} unfinished. Closing is still allowed.`}
        </CardDescription>
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-success">Green</span> = OK ·{' '}
          <span className="font-medium text-warning">Yellow</span> = unfinished (soft close OK) ·{' '}
          <span className="font-medium text-destructive">Red</span> = books disagree (must fix). Same
          fix steps either way — red only refuses the Close button until it is clear.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2.5">
          {checks.map((check) => {
            const Icon = ICON[check.severity]
            return (
              <li key={check.key} className="flex items-start gap-2.5 text-sm">
                <Icon
                  className={`mt-0.5 size-4 shrink-0 ${TONE[check.severity]}`}
                  aria-label={SEVERITY_LABEL[check.severity]}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{check.label}</span>
                  <span className="block text-muted-foreground">{check.detail}</span>
                  {check.severity !== 'ok' && check.howTo ? (
                    <span className="mt-1 block rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs text-foreground">
                      <span className="font-medium">How to fix: </span>
                      {check.howTo}
                      {check.href ? (
                        <>
                          {' '}
                          <Link
                            href={check.href}
                            className="font-medium text-primary underline underline-offset-4"
                          >
                            Open fix page →
                          </Link>
                        </>
                      ) : null}
                    </span>
                  ) : check.href && check.severity !== 'ok' ? (
                    <span className="mt-0.5 block">
                      <Link href={check.href} className="text-primary underline underline-offset-4">
                        Open fix page →
                      </Link>
                    </span>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
        {action}
      </CardContent>
    </Card>
  )
}
