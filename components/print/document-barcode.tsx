'use client'

import { useMemo } from 'react'

import { canEncodeCode128, code128Svg } from '@/lib/barcode-code128-svg'
import { cn } from '@/lib/utils'

/**
 * Scannable Code 128 for printed papers (invoice, delivery note, store ticket).
 * Renders nothing when the value cannot be encoded — never breaks the sheet.
 */
export function DocumentBarcode({
  value,
  className,
  height = 44,
  moduleWidth = 1.25,
  showText = true,
}: {
  value: string | null | undefined
  className?: string
  height?: number
  moduleWidth?: number
  showText?: boolean
}) {
  const svg = useMemo(() => {
    const raw = value?.trim() ?? ''
    if (!canEncodeCode128(raw)) return null
    try {
      return code128Svg(raw, { height, moduleWidth, showText })
    } catch {
      return null
    }
  }, [value, height, moduleWidth, showText])

  if (!svg) return null

  return (
    <div
      className={cn('inline-block max-w-full overflow-hidden [&_svg]:h-auto [&_svg]:max-w-full', className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
