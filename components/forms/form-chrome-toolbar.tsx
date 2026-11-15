'use client'

import { useRouter } from 'next/navigation'
import { CopyIcon, PlusIcon, PrinterIcon, SaveIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Light QuickBooks-style chrome for create-only transaction forms
 * (bill payments, banking, inventory moves).
 */
export function FormChromeToolbar({
  newHref,
  canSave,
  printHref,
  copyHref,
}: {
  newHref: string
  canSave: boolean
  /** When set, Print navigates here; otherwise `window.print()`. */
  printHref?: string
  /** When set, shows Copy (Make a copy) — usually `…/new?copy={id}` from a list. */
  copyHref?: string
}) {
  const router = useRouter()

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-background p-1.5 print:hidden">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          if (printHref) router.push(printHref)
          else window.print()
        }}
      >
        <PrinterIcon />
        Print
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => router.push(newHref)}>
        <PlusIcon />
        New
      </Button>
      {copyHref ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          title="Make a copy"
          onClick={() => router.push(copyHref)}
        >
          <CopyIcon />
          Copy
        </Button>
      ) : null}
      <Button type="submit" size="sm" disabled={!canSave}>
        <SaveIcon />
        Save
      </Button>
    </div>
  )
}
