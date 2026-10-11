'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2Icon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Field } from '@/components/forms/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { deleteDocument, deletePayment } from '@/app/(app)/sales/actions'
import { deleteBillPayment, deletePurchase } from '@/app/(app)/purchases/actions'
import { deleteDeposit, deleteTransfer } from '@/app/(app)/banking/actions'
import { deleteAdjustment } from '@/app/(app)/inventory/actions'
import { deleteJournal } from '@/app/(app)/journals/actions'
import { deleteItem } from '@/app/(app)/items/actions'

/**
 * Deleting a record, wherever it lives.
 *
 * **One verb.** Delete. There is no Void here, no Reverse, no "close instead",
 * and no branching on what the record happens to be — the person clicked Delete
 * and the record goes. Whatever has to happen underneath to make that safe (the
 * journal withdrawn, stock put back, payments released, a purchase order's count
 * restored) happens in the service, and is not the user's problem or the user's
 * vocabulary. `server/accounting/deletion.ts` explains the mechanism.
 *
 * Two shapes, because a list and a record page are different rooms.
 * `DeleteButton` is the control on the record's own page; `DeleteMenuItem` is the
 * same thing at the end of a row menu. Both open the same dialog, which names the
 * record and takes an optional reason.
 */
export type DeletableKind =
  | 'sales'
  | 'purchase'
  | 'customer-payment'
  | 'bill-payment'
  | 'transfer'
  | 'deposit'
  | 'inventory-adjustment'
  | 'journal'
  | 'item'

type DeleteCall = (input: { id: string; reason?: string }) => Promise<unknown>

const DELETE: Record<DeletableKind, DeleteCall> = {
  sales: deleteDocument,
  purchase: deletePurchase,
  'customer-payment': deletePayment,
  'bill-payment': deleteBillPayment,
  transfer: deleteTransfer,
  deposit: deleteDeposit,
  'inventory-adjustment': deleteAdjustment,
  journal: deleteJournal,
  item: deleteItem,
}

/** What deleting this one will also take with it, said before it happens. */
const CONSEQUENCE: Record<DeletableKind, string> = {
  sales:
    'Its entry comes out of the ledger, any stock it moved goes back, and payments applied to it are released and sit unapplied against the customer.',
  purchase:
    'Its entry comes out of the ledger and any stock it received goes back out. If it was received against a purchase order, that order shows the goods as still to come.',
  'customer-payment':
    'Its entry comes out of the ledger and the invoices it settled are outstanding again. If it had been banked, that deposit is deleted too and the rest of it goes back to undeposited funds.',
  'bill-payment':
    'Its entry comes out of the ledger and the bills it settled are owing again.',
  transfer: 'The money goes back where it was. Its entry comes out of the ledger.',
  deposit:
    'Its entry comes out of the ledger and the payments it banked go back to undeposited funds.',
  'inventory-adjustment':
    'The stock it counted in or out goes back to what it was, and its entry comes out of the ledger.',
  journal:
    'Its entry comes out of the ledger. If a document produced it, that document is deleted too — they are one transaction.',
  item:
    'It is removed only when nothing names it. If it sits on documents or stock movements, merge it into another item instead.',
}

type Result = { ok: true } | { ok: false; error: { message: string } }

export type DeleteTarget = {
  kind: DeletableKind
  id: string
  /** What to call the record in the dialog and the toast. */
  number: string
  /** Where to go once it is gone. Stays put when omitted. */
  redirectTo?: string
}

export function DeleteButton({
  size = 'sm',
  variant = 'outline',
  ...target
}: DeleteTarget & { size?: 'sm' | 'default'; variant?: 'outline' | 'ghost' }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Trash2Icon /> Delete
      </Button>
      {open ? <DeleteDialog target={target} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export function DeleteMenuItem(target: DeleteTarget) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <DropdownMenuItem
        variant="destructive"
        onSelect={(event) => {
          event.preventDefault()
          setOpen(true)
        }}
      >
        <Trash2Icon className="size-4" />
        Delete
      </DropdownMenuItem>
      {open ? <DeleteDialog target={target} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function DeleteDialog({ target, onClose }: { target: DeleteTarget; onClose: () => void }) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const run = () =>
    startTransition(async () => {
      setError(null)

      const result = (await DELETE[target.kind]({
        id: target.id,
        reason: reason.trim() || undefined,
      })) as Result

      if (result.ok) {
        toast.success(`${target.number} deleted.`)
        onClose()
        if (target.redirectTo) router.push(target.redirectTo)
        router.refresh()
      } else {
        setError(result.error.message)
      }
    })

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !isPending) onClose() }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Delete {target.number}</DialogTitle>
        </DialogHeader>

        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          {CONSEQUENCE[target.kind]}
        </p>

        {error ? (
          <p
            role="alert"
            className="mb-3 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        {/*
          Optional on purpose. Deleting something entered by mistake is an
          ordinary correction, and demanding a written justification for one is
          how a field ends up holding the word "mistake" ten thousand times.
        */}
        <Field name="delete-reason" label="Reason" hint="Optional. Kept on the record.">
          <Input
            id="delete-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Entered twice"
            autoFocus
          />
        </Field>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={run}>
            {isPending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
            Delete {target.number}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
