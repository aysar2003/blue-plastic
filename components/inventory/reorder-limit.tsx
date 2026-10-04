'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { setReorderLimit } from '@/app/(app)/items/actions'
import { Input } from '@/components/ui/input'

/** The quantity that should raise an order warning. Blank means no limit. */
export function ReorderLimitField({ itemId, initial }: { itemId: string; initial: string }) {
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const [pending, startTransition] = useTransition()

  const save = () => {
    if (value.trim() === initial.trim()) return
    startTransition(async () => {
      const result = await setReorderLimit({ id: itemId, reorderPoint: value })
      if (result.ok) {
        toast.success(value.trim() ? 'Reorder limit saved.' : 'Reorder limit cleared.')
        router.refresh()
      } else {
        toast.error(result.error.message)
        setValue(initial)
      }
    })
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        inputMode="decimal"
        aria-label="Reorder limit"
        value={value}
        placeholder="No limit"
        disabled={pending}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            ;(event.target as HTMLInputElement).blur()
          }
        }}
        className="h-8 w-24 px-2 text-right tabular"
      />
      {pending ? <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" /> : null}
    </span>
  )
}
