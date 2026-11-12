'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { buttonVariants } from '@/components/ui/button'
import type { ModuleFlag } from '@/lib/feature-flags'
import { cn } from '@/lib/utils'

import { grantModuleToAll } from '../actions'

export function GrantModuleButton({
  module,
  label,
  missingCount,
  optIn,
}: {
  module: ModuleFlag
  label: string
  missingCount: number
  optIn: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (missingCount <= 0) return null

  function onGrant() {
    const confirmLabel = optIn
      ? `Grant opt-in app "${label}" to ${missingCount} compan${missingCount === 1 ? 'y' : 'ies'}? They can still turn it off under Settings → Apps & features.`
      : `Grant "${label}" to ${missingCount} compan${missingCount === 1 ? 'y' : 'ies'}?`
    if (!window.confirm(confirmLabel)) return

    setError(null)
    startTransition(async () => {
      const result = await grantModuleToAll({ module })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={onGrant}
        className={cn(buttonVariants({ size: 'sm', variant: 'secondary' }), 'w-full')}
      >
        {pending ? 'Granting…' : `Grant to all (${missingCount})`}
      </button>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  )
}
