'use client'

import { CheckIcon } from 'lucide-react'

import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import { cn } from '@/lib/utils'
import {
  parseWebsiteLook,
  WEBSITE_LOOK_KEY,
  WEBSITE_LOOKS,
  type WebsiteLookId,
} from '@/lib/website-look'

export function WebsiteLookPicker() {
  const saved = useBrowserStore(WEBSITE_LOOK_KEY)
  const current = parseWebsiteLook(saved)

  const pick = (id: WebsiteLookId) => {
    writeBrowserStore(WEBSITE_LOOK_KEY, id)
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {WEBSITE_LOOKS.map((option) => {
        const active = current === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => pick(option.id)}
            className={cn(
              'rounded-xl border bg-card p-3 text-left transition-colors',
              active ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/40',
            )}
          >
            <span className="flex gap-1.5" aria-hidden>
              {option.swatches.map((color) => (
                <span
                  key={color}
                  className="h-8 flex-1 rounded-md border border-black/5"
                  style={{ background: color }}
                />
              ))}
            </span>
            <span className="mt-3 flex items-center justify-between gap-2">
              <span className="font-medium">{option.label}</span>
              {active ? <CheckIcon className="size-4 text-primary" /> : null}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{option.blurb}</span>
          </button>
        )
      })}
    </div>
  )
}
