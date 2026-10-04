'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2Icon, ScaleIcon } from 'lucide-react'

import { Field } from '@/components/forms/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { startReconciliation } from '@/app/(app)/banking/actions'

export function StartReconciliationButton({
  accountId,
  accountName,
  today,
  startOpen = false,
  onClose,
}: {
  accountId: string
  accountName: string
  today: string
  /** Opens the statement dialog immediately, with no extra button. */
  startOpen?: boolean
  onClose?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(startOpen)
  const [statementDate, setStatementDate] = useState(today)
  const [balance, setBalance] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const close = () => {
    setOpen(false)
    onClose?.()
  }

  return (
    <>
      {startOpen ? null : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <ScaleIcon /> Reconcile
        </Button>
      )}
      <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Reconcile {accountName}</DialogTitle>
        </DialogHeader>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Take these two figures from the statement. Everything reconciled before this carries forward as
          the opening balance.
        </p>

        {error ? (
          <p role="alert" className="mb-3 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="space-y-4">
          <Field name="statementDate" label="Statement date" required>
            <DateField id="statementDate" value={statementDate} onChange={setStatementDate} />
          </Field>
          <Field name="endingBalance" label="Closing balance on the statement" required>
            <Input
              id="endingBalance"
              inputMode="decimal"
              className="tabular"
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={close} disabled={isPending}>
            Cancel
          </Button>
          <Button
            disabled={isPending || balance.trim() === ''}
            onClick={() =>
              startTransition(async () => {
                setError(null)
                const result = await startReconciliation({
                  accountId,
                  statementDate,
                  statementEndingBalance: balance,
                })
                if (result.ok) router.push(`/banking/reconcile/${result.data.id}`)
                else setError(result.error.message)
              })
            }
          >
            {isPending ? <Loader2Icon className="animate-spin" /> : null}
            Start
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
