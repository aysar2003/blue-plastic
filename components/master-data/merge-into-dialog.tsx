'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { mergeAccounts } from '@/app/(app)/accounts/actions'
import { mergeCustomers, mergeVendors } from '@/app/(app)/customers/actions'
import { mergeItems } from '@/app/(app)/items/actions'
import { listMergeTargets } from '@/app/(app)/master-data/actions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/native-select'

export type MergeKind = 'customer' | 'vendor' | 'item' | 'account'

export type MergeOption = { id: string; label: string }

const MERGE = {
  customer: mergeCustomers,
  vendor: mergeVendors,
  item: mergeItems,
  account: mergeAccounts,
} as const

/**
 * Fold this record into another of the same kind. The survivor keeps its name;
 * every transaction moves across and this one is removed.
 */
export function MergeIntoDialog({
  open,
  onClose,
  kind,
  absorbId,
  absorbLabel,
  options: seededOptions = [],
}: {
  open: boolean
  onClose: () => void
  kind: MergeKind
  absorbId: string
  absorbLabel: string
  options?: MergeOption[]
}) {
  const router = useRouter()
  const [choices, setChoices] = useState<MergeOption[]>(
    seededOptions.filter((option) => option.id !== absorbId),
  )
  const [keepId, setKeepId] = useState(choices[0]?.id ?? '')
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the spinner while the merge-target request is in flight
    setLoading(true)
    void listMergeTargets({ kind, id: absorbId }).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      setChoices(result.data)
      setKeepId(result.data[0]?.id ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [open, kind, absorbId])

  if (!open) return null

  const confirm = () => {
    if (!keepId) {
      toast.error('Choose the record to keep.')
      return
    }
    startTransition(async () => {
      const result = await MERGE[kind]({ keepId, absorbId })
      if (result.ok) {
        toast.success(`Merged into ${result.data.keepName}.`)
        onClose()
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Merge “{absorbLabel}”</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Every transaction on this record moves into the one you keep. The name that
          remains is the keeper&rsquo;s name. This record is then removed.
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : choices.length === 0 ? (
          <p className="text-sm text-destructive">No other record of this kind to merge into.</p>
        ) : (
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Keep</span>
            <NativeSelect
              value={keepId}
              onChange={(event) => setKeepId(event.target.value)}
              disabled={isPending}
            >
              {choices.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={isPending || loading || choices.length === 0}>
            Merge
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
