'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { toggleSetupChecklistItem } from '@/app/(app)/onboarding/actions'
import { Button } from '@/components/ui/button'

export function GettingStartedHome({
  title,
  blurb,
  hubHref,
  hubLabel,
  items,
  doneIds,
  canEdit,
}: {
  title: string
  blurb: string
  hubHref: string
  hubLabel: string
  items: { id: string; label: string; href: string }[]
  doneIds: string[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [done, setDone] = useState(() => new Set(doneIds))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const remaining = items.filter((item) => !done.has(item.id))
  if (remaining.length === 0) return null

  const next = remaining[0]
  const total = items.length
  const completed = total - remaining.length

  function toggle(itemId: string, nextDone: boolean) {
    if (!canEdit) return
    setError(null)
    startTransition(async () => {
      const result = await toggleSetupChecklistItem({ itemId, done: nextDone })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setDone(new Set(result.data.checklistDone))
      router.refresh()
    })
  }

  return (
    <div className="mx-auto w-full px-[clamp(0.75rem,2vw,2.5rem)] pt-6">
      <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Getting started · {completed}/{total}
            </p>
            <h2 className="mt-1 text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={hubHref}>Open {hubLabel}</Link>
          </Button>
        </div>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button asChild size="sm" disabled={pending}>
            <Link href={next.href}>Next: {next.label}</Link>
          </Button>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => toggle(next.id, true)}
            >
              Mark done
            </Button>
          ) : null}
          <Link
            href="/settings/setup"
            className="text-xs font-medium text-muted-foreground underline underline-offset-4"
          >
            Full checklist
          </Link>
        </div>

        <ul className="mt-4 space-y-1.5">
          {items.slice(0, 6).map((item) => {
            const checked = done.has(item.id)
            return (
              <li key={item.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-input"
                  checked={checked}
                  disabled={pending || !canEdit}
                  onChange={(event) => toggle(item.id, event.target.checked)}
                />
                <Link
                  href={item.href}
                  className={
                    checked
                      ? 'text-muted-foreground line-through'
                      : 'text-foreground underline-offset-2 hover:underline'
                  }
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
          {items.length > 6 ? (
            <li className="text-[11px] text-muted-foreground">
              +{items.length - 6} more in Settings → Setup
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}
