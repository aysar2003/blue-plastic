'use client'

import { useRouter } from 'next/navigation'

import { removeBookmark } from '@/app/(app)/workspace/actions'

export function HomePins({ pins }: { pins: { id: string; href: string; label: string }[] }) {
  const router = useRouter()
  if (pins.length === 0) return null

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {pins.map((pin) => (
        <span
          key={pin.id}
          className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-1 pl-3 pr-1 text-sm font-medium text-primary"
        >
          <a href={pin.href}>{pin.label}</a>
          <button
            type="button"
            aria-label={`Remove ${pin.label}`}
            className="rounded-full px-1.5 text-primary/70 hover:bg-primary/15"
            onClick={() => {
              void removeBookmark({ id: pin.id }).then(() => router.refresh())
            }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}
