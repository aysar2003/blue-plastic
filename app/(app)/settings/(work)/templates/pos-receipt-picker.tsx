'use client'

import { CheckIcon } from 'lucide-react'

import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import {
  DEFAULT_RECEIPT_PAPER,
  parseReceiptPaper,
  RECEIPT_PAPER_KEY,
  RECEIPT_PAPERS,
  type ReceiptPaper,
} from '@/lib/pos-receipt'
import { cn } from '@/lib/utils'

const OPTIONS: { id: ReceiptPaper; label: string; blurb: string }[] = [
  {
    id: '80',
    label: '80 mm',
    blurb: `Standard counter roll — ${RECEIPT_PAPERS['80'].widthMm} mm wide.`,
  },
  {
    id: '58',
    label: '58 mm',
    blurb: `Narrow till roll — ${RECEIPT_PAPERS['58'].widthMm} mm wide.`,
  },
]

export function PosReceiptPicker() {
  const saved = useBrowserStore(RECEIPT_PAPER_KEY)
  const current = parseReceiptPaper(saved ?? DEFAULT_RECEIPT_PAPER)

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">POS thermal receipt</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Width of the slip the till printer cuts. Match the paper in your printer.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const active = option.id === current
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => writeBrowserStore(RECEIPT_PAPER_KEY, option.id)}
              className={cn(
                'rounded-xl border px-3 py-3 text-left transition-colors',
                active
                  ? 'border-primary bg-accent/40 ring-2 ring-primary/25'
                  : 'border-border bg-background hover:border-primary/40 hover:bg-secondary/50',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{option.label}</span>
                {active ? <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden /> : null}
              </span>
              <span className="mt-1 block text-xs leading-snug text-muted-foreground">{option.blurb}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
