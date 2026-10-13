'use client'

import type { ItemType } from '@prisma/client'

import { cn } from '@/lib/utils'
import { ITEM_TYPE_PROFILES } from '@/lib/item-types'

export function ItemTypePicker({
  value,
  onPick,
}: {
  value?: ItemType | null
  /** Choosing a type opens that type’s form immediately. */
  onPick: (next: ItemType) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Choose item type</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Each type opens its own form and account rules. You can change type later only while the
          item has never been used on a document or journal.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ITEM_TYPE_PROFILES.map((profile) => {
          const active = profile.value === value
          return (
            <button
              key={profile.value}
              type="button"
              onClick={() => onPick(profile.value)}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-left transition',
                active
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border hover:border-foreground/30 hover:bg-muted/40',
              )}
            >
              <span className="block text-sm font-semibold text-foreground">{profile.label}</span>
              <span className="mt-0.5 block text-[0.65rem] leading-snug text-muted-foreground">
                {profile.blurb}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
