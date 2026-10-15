'use client'

import { useEffect, useState } from 'react'
import { PrinterIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { code128Svg } from '@/lib/barcode-code128-svg'
import { cn } from '@/lib/utils'

export type LabelRow = {
  id: string
  name: string
  sku: string | null
  barcode: string
}

/** Common USB/thermal barcode label stock sizes (width × height). */
const LABEL_SIZES = {
  '50x25': { w: 50, h: 25, label: '50×25 mm' },
  '40x30': { w: 40, h: 30, label: '40×30 mm' },
  '60x40': { w: 60, h: 40, label: '60×40 mm' },
} as const

type LabelSize = keyof typeof LABEL_SIZES
const LABEL_SIZE_KEY = 'som.barcodeLabelSize'
const DEFAULT_SIZE: LabelSize = '50x25'

function parseLabelSize(raw: string | null): LabelSize {
  if (raw && raw in LABEL_SIZES) return raw as LabelSize
  return DEFAULT_SIZE
}

/**
 * Printable barcode labels for a dedicated barcode / thermal label printer.
 * Each sticker is one page sized to the roll so the machine feeds one label at a time.
 */
export function LabelSheet({
  rows,
  autoprint = false,
  className,
}: {
  rows: LabelRow[]
  autoprint?: boolean
  className?: string
}) {
  const [size, setSize] = useState<LabelSize>(DEFAULT_SIZE)
  const [ready, setReady] = useState(false)
  const spec = LABEL_SIZES[size]

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage only exists after mount */
    setSize(parseLabelSize(window.localStorage.getItem(LABEL_SIZE_KEY)))
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  useEffect(() => {
    if (!autoprint || !ready || rows.length === 0) return
    const timer = window.setTimeout(() => window.print(), 250)
    return () => window.clearTimeout(timer)
  }, [autoprint, ready, rows.length])

  function chooseSize(next: LabelSize) {
    setSize(next)
    window.localStorage.setItem(LABEL_SIZE_KEY, next)
  }

  const barHeight = Math.max(28, Math.round(spec.h * 1.6))
  const moduleWidth = spec.w >= 60 ? 1.5 : 1.25

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button type="button" onClick={() => window.print()} disabled={rows.length === 0}>
          <PrinterIcon /> Print labels
        </Button>
        <div
          className="inline-flex overflow-hidden rounded-md border text-sm"
          role="group"
          aria-label="Label size"
        >
          {(Object.keys(LABEL_SIZES) as LabelSize[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={size === option}
              onClick={() => chooseSize(option)}
              className={
                size === option
                  ? 'bg-primary px-3 py-2 font-semibold text-primary-foreground'
                  : 'bg-background px-3 py-2 text-foreground hover:bg-muted'
              }
            >
              {LABEL_SIZES[option].label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Choose your barcode label printer in the print dialog. Match the size to your label roll.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No barcodes to print yet. Generate codes first, then come back here.
        </p>
      ) : (
        <div className="barcode-label-stack flex flex-col items-start gap-3 print:gap-0">
          {rows.map((row) => (
            <article
              key={row.id}
              className="barcode-label flex flex-col justify-center overflow-hidden border bg-white text-black shadow-sm print:border-0 print:shadow-none"
              style={{ width: `${spec.w}mm`, height: `${spec.h}mm`, padding: '1.5mm 2mm' }}
            >
              <p className="truncate text-[9px] font-semibold leading-tight">{row.name}</p>
              {row.sku ? (
                <p className="truncate text-[7px] leading-tight text-neutral-600">SKU {row.sku}</p>
              ) : null}
              <div
                className="mt-0.5 flex flex-1 items-center justify-center overflow-hidden [&_svg]:max-h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{
                  __html: code128Svg(row.barcode, { height: barHeight, moduleWidth }),
                }}
              />
            </article>
          ))}
        </div>
      )}

      <style>{`
        @media print {
          @page {
            size: ${spec.w}mm ${spec.h}mm;
            margin: 0;
          }
          html, body {
            width: ${spec.w}mm;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .barcode-label-stack {
            display: block !important;
          }
          .barcode-label {
            width: ${spec.w}mm !important;
            height: ${spec.h}mm !important;
            box-sizing: border-box;
            page-break-after: always;
            break-after: page;
          }
          .barcode-label:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>
    </div>
  )
}
