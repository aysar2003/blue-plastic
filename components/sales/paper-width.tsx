'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

const STORAGE_KEY = 'bpc.salesPaperWidth'

const SIZES = [
  { id: 'small', label: 'Small', className: 'max-w-3xl' },
  { id: 'medium', label: 'Medium', className: 'max-w-4xl' },
  { id: 'large', label: 'Large', className: 'max-w-none' },
] as const

type PaperSize = (typeof SIZES)[number]['id']

const DEFAULT_SIZE: PaperSize = 'medium'

function parseSize(raw: string | null): PaperSize {
  return SIZES.some((size) => size.id === raw) ? (raw as PaperSize) : DEFAULT_SIZE
}

function readSize(): PaperSize {
  try {
    return parseSize(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_SIZE
  }
}

function writeSize(size: PaperSize) {
  try {
    window.localStorage.setItem(STORAGE_KEY, size)
  } catch {
    // Private mode: the choice applies for this view only.
  }
  window.dispatchEvent(new CustomEvent('bpc-sales-paper-size', { detail: size }))
}

function usePaperSize() {
  const [size, setSize] = useState<PaperSize>(DEFAULT_SIZE)

  useEffect(() => {
    setSize(readSize())
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      setSize(parseSize(detail))
    }
    window.addEventListener('bpc-sales-paper-size', onChange)
    return () => window.removeEventListener('bpc-sales-paper-size', onChange)
  }, [])

  return [size, writeSize] as const
}

/**
 * Centers a sales or vendor form and offers Small, Medium, and Large.
 * The choice is remembered in this browser and shared by every paper that uses it.
 */
export function SalesPaperFrame({
  children,
}: {
  /** Document type, accepted so existing pages can pass it. Width does not depend on it. */
  type?: string
  children: ReactNode
}) {
  const [size, setSize] = usePaperSize()
  const chosen = SIZES.find((option) => option.id === size) ?? SIZES[1]

  return (
    <div className={cn('mx-auto w-full print:max-w-none', chosen.className)}>
      <div className="mb-2 flex justify-end print:hidden">
        <div
          role="group"
          aria-label="Form size"
          className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs"
        >
          {SIZES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={size === option.id}
              onClick={() => setSize(option.id)}
              className={cn(
                'rounded px-2.5 py-1 font-medium',
                size === option.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}
