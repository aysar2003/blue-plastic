'use client'

import { useMemo, useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2Icon, Loader2Icon, Undo2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Field } from '@/components/forms/field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDate, toCalendarDate } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { JOURNAL_SOURCE_LABELS } from '@/lib/accounting-labels'
import { cn } from '@/lib/utils'
import {
  clearAll,
  finishReconciliation,
  toggleCleared,
  undoReconciliation,
} from '@/app/(app)/banking/actions'
import type { JournalSourceType } from '@prisma/client'

export type ReconcileLine = {
  lineId: string
  journalId: string
  journalNumber: string
  date: string
  description: string | null
  memo: string | null
  sourceType: string
  amount: string
  cleared: boolean
}

/**
 * The reconciliation screen.
 *
 * One number decides everything: `beginning + cleared − statement closing`. It is
 * shown large, it updates as boxes are ticked, and Finish stays disabled until it
 * is exactly zero. A reconciliation that can be finished while it is out is not a
 * reconciliation — it is a note saying somebody looked.
 */
export function ReconcileView({
  id,
  accountName,
  statementDate,
  beginningBalance,
  statementEndingBalance,
  lines,
  completed,
  currency,
  canReconcile,
}: {
  id: string
  accountName: string
  statementDate: string
  beginningBalance: string
  statementEndingBalance: string
  lines: ReconcileLine[]
  completed: boolean
  currency: string
  canReconcile: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState('')
  const [undoing, setUndoing] = useState(false)
  const [undoReason, setUndoReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Ticking a box feels instant; the server is the authority a moment later.
  const [optimistic, setOptimistic] = useOptimistic(
    lines,
    (current: ReconcileLine[], change: { lineId: string; cleared: boolean }) =>
      current.map((line) => (line.lineId === change.lineId ? { ...line, cleared: change.cleared } : line)),
  )

  const figures = useMemo(() => {
    const beginning = new Decimal(beginningBalance)
    const ending = new Decimal(statementEndingBalance)
    const cleared = optimistic
      .filter((line) => line.cleared)
      .reduce((sum, line) => sum.plus(line.amount), ZERO)
    const difference = beginning.plus(cleared).minus(ending)
    return { beginning, ending, cleared, difference, balanced: difference.isZero() }
  }, [optimistic, beginningBalance, statementEndingBalance])

  const deposits = optimistic.filter((line) => new Decimal(line.amount).greaterThan(0))
  const withdrawals = optimistic.filter((line) => new Decimal(line.amount).lessThan(0))

  const toggle = (line: ReconcileLine) =>
    startTransition(async () => {
      setOptimistic({ lineId: line.lineId, cleared: !line.cleared })
      const result = await toggleCleared({
        reconciliationId: id,
        journalLineId: line.lineId,
        cleared: !line.cleared,
      })
      if (!result.ok) toast.error(result.error.message)
      router.refresh()
    })

  return (
    <>
      <Card className="mb-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Figure label="Opening balance" value={formatMoney(figures.beginning, currency)} />
          <Figure label="Cleared here" value={formatMoney(figures.cleared, currency)} />
          <Figure label="Books say" value={formatMoney(figures.beginning.plus(figures.cleared), currency)} />
          <Figure label="Statement says" value={formatMoney(figures.ending, currency)} />
          <div
            className={cn(
              'rounded-md border px-3 py-2',
              figures.balanced ? 'border-success/40 bg-success/8' : 'border-destructive/40 bg-destructive/8',
            )}
          >
            <p className="text-xs text-muted-foreground">Difference</p>
            <p
              className={cn(
                'tabular mt-0.5 text-lg font-semibold',
                figures.balanced ? 'text-success' : 'text-destructive',
              )}
            >
              {formatMoney(figures.difference, currency)}
            </p>
          </div>
        </div>

        {!completed && canReconcile ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={isPending || optimistic.every((line) => line.cleared)}
              onClick={() =>
                startTransition(async () => {
                  const result = await clearAll({ reconciliationId: id })
                  if (!result.ok) toast.error(result.error.message)
                  router.refresh()
                })
              }
            >
              Tick everything
            </Button>

            <div className="flex flex-wrap items-end gap-2">
              <Field name="notes" label="Note (optional)" className="w-64">
                <Input id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </Field>
              <Button
                disabled={!figures.balanced || isPending}
                title={figures.balanced ? undefined : 'The difference must be zero'}
                onClick={() =>
                  startTransition(async () => {
                    const result = await finishReconciliation({ reconciliationId: id, notes })
                    if (result.ok) {
                      toast.success(`${accountName} reconciled to ${statementDate}.`)
                      router.push('/banking/accounts')
                      router.refresh()
                    } else {
                      toast.error(result.error.message)
                    }
                  })
                }
              >
                {isPending ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />}
                Finish
              </Button>
            </div>
          </div>
        ) : null}

        {completed ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2Icon className="size-4" />
              Reconciled. These items are locked; the journal entries behind them were never touched.
            </p>
            {canReconcile ? (
              <Button variant="outline" size="sm" onClick={() => setUndoing(true)}>
                <Undo2Icon /> Undo
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <LineList
          title="Money in"
          lines={deposits}
          currency={currency}
          disabled={completed || !canReconcile || isPending}
          onToggle={toggle}
        />
        <LineList
          title="Money out"
          lines={withdrawals}
          currency={currency}
          disabled={completed || !canReconcile || isPending}
          onToggle={toggle}
        />
      </div>

      {undoing ? (
        <Dialog open onOpenChange={(next) => { if (!next) setUndoing(false) }}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Undo this reconciliation</DialogTitle>
              <DialogDescription>
                The reconciliation is deleted and every item it cleared becomes available again. The journal
                entries themselves are untouched — they always were. This is logged.
              </DialogDescription>
            </DialogHeader>

            {error ? (
              <p role="alert" className="mb-3 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Field name="undo-reason" label="Reason" required>
              <Input
                id="undo-reason"
                value={undoReason}
                onChange={(event) => setUndoReason(event.target.value)}
                placeholder="Statement was reissued"
                autoFocus
              />
            </Field>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUndoing(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={isPending || undoReason.trim() === ''}
                onClick={() =>
                  startTransition(async () => {
                    setError(null)
                    const result = await undoReconciliation({ id, reason: undoReason })
                    if (result.ok) {
                      toast.success('Reconciliation undone.')
                      router.push('/banking/accounts')
                      router.refresh()
                    } else {
                      setError(result.error.message)
                    }
                  })
                }
              >
                {isPending ? <Loader2Icon className="animate-spin" /> : null}
                Undo it
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-0.5 text-base font-medium">{value}</p>
    </div>
  )
}

function LineList({
  title,
  lines,
  currency,
  disabled,
  onToggle,
}: {
  title: string
  lines: ReconcileLine[]
  currency: string
  disabled: boolean
  onToggle: (line: ReconcileLine) => void
}) {
  const clearedTotal = lines
    .filter((line) => line.cleared)
    .reduce((sum, line) => sum.plus(line.amount), ZERO)

  return (
    <Card className="overflow-hidden p-0">
      <div className="panel-head">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="tabular text-sm text-muted-foreground">
          {lines.filter((l) => l.cleared).length} of {lines.length} ·{' '}
          {formatMoney(clearedTotal.abs(), currency)}
        </span>
      </div>

      {lines.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="divide-y">
          {lines.map((line) => (
            <li key={line.lineId}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={line.cleared}
                  disabled={disabled}
                  onChange={() => onToggle(line)}
                  className="size-4 shrink-0 rounded border-input"
                  aria-label={`Clear ${line.journalNumber}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {line.description ?? line.memo ?? '—'}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    <span className="tabular">{formatDate(toCalendarDate(new Date(line.date)))}</span>
                    {' · '}
                    <Link
                      href={`/journals/${line.journalId}`}
                      className="underline-offset-4 hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {line.journalNumber}
                    </Link>
                    {' · '}
                    {JOURNAL_SOURCE_LABELS[line.sourceType as JournalSourceType] ?? line.sourceType}
                  </span>
                </span>
                <span className="tabular shrink-0 text-sm font-medium">
                  {formatMoney(new Decimal(line.amount).abs(), currency)}
                </span>
                {line.cleared ? <Badge variant="success">cleared</Badge> : null}
              </label>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
