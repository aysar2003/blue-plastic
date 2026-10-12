'use client'

import { CheckIcon } from 'lucide-react'

import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import { cn } from '@/lib/utils'

type Option = { id: string; label: string; blurb: string }

export function FormLayoutPicker({
  title,
  description,
  storageKey,
  options,
  defaultId,
  parse,
}: {
  title: string
  description: string
  storageKey: string
  options: readonly Option[]
  defaultId: string
  parse: (raw: string | null | undefined) => string
}) {
  const saved = useBrowserStore(storageKey)
  const current = parse(saved) || defaultId

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => {
          const active = option.id === current
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => writeBrowserStore(storageKey, option.id)}
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
      <p className="text-xs text-muted-foreground">
        Saved in this browser. Sales screens open on the layout you pick here.
      </p>
    </section>
  )
}
