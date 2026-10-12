'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { recordPaymentPromise, setInvoiceUnOverdue } from '@/app/(app)/sales/actions'
import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { today } from '@/lib/date'

/** Dropdown entries. Host PaymentPromiseDialog outside the menu so it stays open. */
export function InvoiceCollectionsMenuItems({
  invoiceId,
  excludeFromOverdue,
  canEdit,
  onRecordPromise,
}: {
  invoiceId: string
  excludeFromOverdue: boolean
  canEdit: boolean
  onRecordPromise: () => void
}) {
  const router = useRouter()
  if (!canEdit) return null

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={(event) => {
          event.preventDefault()
          onRecordPromise()
        }}
      >
        Record payment promise…
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          void setInvoiceUnOverdue({ id: invoiceId, exclude: !excludeFromOverdue }).then((result) => {
            if (!result.ok) {
              toast.error(result.error.message)
              return
            }
            toast.success(
              excludeFromOverdue
                ? 'Back on the overdue list.'
                : 'Removed from overdue (un overdue).',
            )
            router.refresh()
          })
        }}
      >
        {excludeFromOverdue ? 'Return to overdue' : 'Un overdue'}
      </DropdownMenuItem>
    </>
  )
}

export function PaymentPromiseDialog({
  invoiceId,
  initialDate,
  onClose,
}: {
  invoiceId: string
  initialDate: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [promisedDate, setPromisedDate] = useState(initialDate ?? today())
  const [note, setNote] = useState('')

  const save = () => {
    startTransition(async () => {
      const result = await recordPaymentPromise({
        id: invoiceId,
        promisedDate,
        note: note.trim() || null,
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Payment promise recorded.')
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Payment promise</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Agree a new pay-by date with the customer. Overdue lists use this date until it passes;
          the original invoice due date stays on the books.
        </p>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="promisedDate">Promised pay by</Label>
            <DateField
              id="promisedDate"
              value={promisedDate}
              onChange={setPromisedDate}
              today={today()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promiseNote">Note (optional)</Label>
            <Input
              id="promiseNote"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Phone call, visit, …"
              maxLength={500}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={pending || !promisedDate}>
            {pending ? 'Saving…' : 'Save promise'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
