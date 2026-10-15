'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DownloadIcon,
  Loader2Icon,
  PrinterIcon,
  ScanBarcodeIcon,
  SparklesIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  filterBarcodeCatalog,
  type BarcodeDeskFilter,
} from '@/lib/barcode-catalog'
import { cn } from '@/lib/utils'
import type { BarcodeItemRow } from '@/server/services/barcode.service'
import { generateMissingBarcodes, generateOneBarcode } from './actions'

export function BarcodesBoard({
  total,
  activeTotal,
  withBarcode,
  withoutBarcode,
  inactiveMissing,
  missing,
  labelled,
  catalog,
  canEdit,
}: {
  total: number
  activeTotal: number
  withBarcode: number
  withoutBarcode: number
  inactiveMissing: number
  missing: BarcodeItemRow[]
  labelled: BarcodeItemRow[]
  catalog: BarcodeItemRow[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  const [replace, setReplace] = useState(false)
  const [filter, setFilter] = useState<BarcodeDeskFilter>('all')

  const filtered = useMemo(() => {
    const rows = filterBarcodeCatalog(catalog, filter, query)
    // Without a search, keep the table short so the desk stays usable.
    if (!query.trim()) return rows.slice(0, filter === 'all' ? 40 : 80)
    return rows.slice(0, 120)
  }, [catalog, filter, query])

  const generateAll = () =>
    startTransition(async () => {
      const result = await generateMissingBarcodes({})
      if (result.ok) {
        toast.success(
          result.data.assigned === 0
            ? 'Every active product already has a barcode.'
            : `Generated ${result.data.assigned} barcode${result.data.assigned === 1 ? '' : 's'}.`,
        )
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })

  const generateOne = (id: string) =>
    startTransition(async () => {
      const result = await generateOneBarcode({ id, replace })
      if (result.ok) {
        toast.success(`Barcode ${result.data.barcode} saved on ${result.data.name}.`)
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Products"
          value={total}
          hint={`${activeTotal} active`}
          selected={filter === 'all'}
          onSelect={() => setFilter('all')}
        />
        <Stat
          label="With barcode"
          value={withBarcode}
          tone="success"
          hint="Ready to print or export"
          selected={filter === 'with'}
          onSelect={() => setFilter('with')}
        />
        <Stat
          label="Need a barcode"
          value={withoutBarcode}
          tone="warning"
          hint={
            inactiveMissing > 0
              ? `${inactiveMissing} archived also missing`
              : 'Active products still blank'
          }
          selected={filter === 'without'}
          onSelect={() => setFilter('without')}
        />
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ScanBarcodeIcon className="size-4" /> Barcode desk
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate internal EAN-13 codes for products that still need one, print labels on a
              barcode printer, or download Excel for the workshop.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button disabled={isPending || withoutBarcode === 0} onClick={generateAll}>
                {isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                Generate for all missing ({withoutBarcode})
              </Button>
            ) : null}
            {/* File download — not a page navigation */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/exports/barcodes"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              <DownloadIcon /> Excel
            </a>
            <Link href="/barcodes/print" className={cn(buttonVariants({ variant: 'outline' }))}>
              <PrinterIcon /> Print labels
            </Link>
          </div>
        </div>

        {missing.length > 0 ? (
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Active products still without a barcode
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
              {missing.slice(0, 30).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{row.name}</span>
                  {canEdit ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => generateOne(row.id)}
                    >
                      Generate
                    </Button>
                  ) : null}
                </li>
              ))}
              {missing.length > 30 ? (
                <li className="text-xs text-muted-foreground">+{missing.length - 30} more</li>
              ) : null}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Every active product has a barcode. Print labels on your barcode printer or download
            Excel whenever you need fresh stickers.
          </p>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="barcode-item-search" className="text-sm font-medium">
              {filter === 'with'
                ? 'Products with a barcode'
                : filter === 'without'
                  ? 'Products that need a barcode'
                  : 'One product'}
            </label>
            <Input
              id="barcode-item-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, SKU, or barcode"
              className="mt-1.5"
            />
          </div>
          {canEdit ? (
            <label className="flex items-center gap-2 pb-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={replace}
                onChange={(event) => setReplace(event.target.checked)}
                className="size-4 rounded border-input"
              />
              Replace existing barcode
            </label>
          ) : null}
        </div>

        <div className="max-h-80 overflow-y-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Barcode</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.sku ? `SKU ${row.sku}` : 'No SKU'}
                      {!row.isActive ? ' · archived' : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.barcode ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {row.barcode ? (
                        <Link
                          href={`/barcodes/print?ids=${row.id}`}
                          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                        >
                          Print
                        </Link>
                      ) : null}
                      {canEdit ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending || (Boolean(row.barcode) && !replace)}
                          onClick={() => generateOne(row.id)}
                        >
                          {row.barcode ? 'Replace' : 'Generate'}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                    No products match.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {labelled.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {labelled.length} labelled product{labelled.length === 1 ? '' : 's'} ready for{' '}
            <Link href="/barcodes/print" className="underline-offset-4 hover:underline">
              print
            </Link>{' '}
            or{' '}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download */}
            <a href="/api/exports/barcodes" className="underline-offset-4 hover:underline">
              Excel
            </a>
            .
          </p>
        ) : null}
      </Card>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone,
  selected,
  onSelect,
}: {
  label: string
  value: number
  hint?: string
  tone?: 'success' | 'warning'
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'rounded-xl border bg-card p-4 text-left shadow-sm transition-colors',
        'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        selected && 'border-primary ring-2 ring-primary/20',
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning-foreground dark:text-warning',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </button>
  )
}
