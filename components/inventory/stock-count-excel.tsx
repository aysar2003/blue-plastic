'use client'

import { useRef, useState, useTransition } from 'react'
import { DownloadIcon, Loader2Icon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'

import { parseStockCountImport } from '@/app/(app)/inventory/actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { StockCountImportLine } from '@/lib/stock-count-sheet'

type CatalogItem = { id: string; label: string; sku?: string | null; onHand: string }

/**
 * Export a stock-count workbook, edit counts offline, import only the rows you
 * changed — same idea as Odoo POS product export/import.
 */
export function StockCountExcelTools({
  catalog,
  onImport,
}: {
  catalog: CatalogItem[]
  onImport: (lines: StockCountImportLine[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  const readFile = (file: File) => {
    const excel = /\.xlsx$/i.test(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      startTransition(async () => {
        const payload = excel
          ? {
              workbook: String(reader.result ?? '').slice(String(reader.result).indexOf(',') + 1),
              catalog,
            }
          : { csv: String(reader.result ?? ''), catalog }

        const result = await parseStockCountImport(payload)
        if (!result.ok) {
          toast.error(result.error.message)
          return
        }
        const { lines, issues, skipped, total } = result.data
        if (issues.length > 0) {
          toast.message(`${issues.length} row${issues.length === 1 ? '' : 's'} could not be read`, {
            description: issues
              .slice(0, 3)
              .map((issue) => `Row ${issue.row}: ${issue.message}`)
              .join(' · '),
          })
        }
        if (lines.length === 0) {
          toast.error(
            skipped === total
              ? 'No counts to import. Fill "Count found" where the quantity differs from books.'
              : 'Nothing matched. Keep Item ID or SKU from the exported file.',
          )
          return
        }
        onImport(lines)
        toast.success(
          `${lines.length} item${lines.length === 1 ? '' : 's'} loaded into the adjustment` +
            (skipped > 0 ? ` · ${skipped} unchanged skipped` : ''),
        )
      })
    }
    if (excel) reader.readAsDataURL(file)
    else reader.readAsText(file)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href="/api/exports/stock-count"
        download
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        title="Download every tracked item. Fill Count found, then import."
      >
        <DownloadIcon className="size-4" />
        Export Excel
      </a>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? <Loader2Icon className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
        Import Excel
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv,text/csv"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) readFile(file)
        }}
      />
      <p className="text-xs text-muted-foreground">
        Export → fill <span className="font-medium text-foreground">Count found</span> only where stock
        differs → Import. Unchanged rows stay blank and are ignored.
      </p>
    </div>
  )
}
