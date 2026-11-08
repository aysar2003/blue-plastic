'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import Link from 'next/link'

import { toggleSetupChecklistItem, reopenOnboarding } from '@/app/(app)/onboarding/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function SetupChecklistClient({
  items,
  doneIds,
  canEdit,
}: {
  items: { id: string; label: string; href: string }[]
  doneIds: string[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [done, setDone] = useState(() => new Set(doneIds))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle(itemId: string, next: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await toggleSetupChecklistItem({ itemId, done: next })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setDone(new Set(result.data.checklistDone))
      router.refresh()
    })
  }

  function reopen() {
    setError(null)
    startTransition(async () => {
      const result = await reopenOnboarding(undefined)
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      router.push('/onboarding')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Checklist</CardTitle>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={reopen}>
          Re-run wizard
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <ul className="space-y-2">
          {items.map((item) => {
            const checked = done.has(item.id)
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <label className="flex min-w-0 items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    disabled={pending || !canEdit}
                    onChange={(event) => toggle(item.id, event.target.checked)}
                  />
                  <span className={checked ? 'text-muted-foreground line-through' : ''}>
                    {item.label}
                  </span>
                </label>
                <Link href={item.href} className="shrink-0 text-xs underline underline-offset-4">
                  Open
                </Link>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
