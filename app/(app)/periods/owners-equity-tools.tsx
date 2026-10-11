'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DownloadIcon, Loader2Icon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'

import { importOwnersEquityAllocation } from './actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Export the owners capital list, fill Amount to allocate offline, import to
 * move retained earnings into each owner account.
 */
export function OwnersEquityTools({
  retainedBalance,
  retainedLabel,
  ownerCount,
  canImport,
}: {
  retainedBalance: string
  retainedLabel: string
  ownerCount: number
  canImport: boolean
}) {
  const router = useRouter()
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
            }
          : { csv: String(reader.result ?? '') }

        const result = await importOwnersEquityAllocation(payload)
        if (!result.ok) {
          toast.error(result.error.message)
          return
        }
        toast.success(
          `Posted ${result.data.journalNumber}: ${result.data.total} to ${result.data.lineCount} owner${result.data.lineCount === 1 ? '' : 's'}.`,
        )
        router.refresh()
      })
    }
    if (excel) reader.readAsDataURL(file)
    else reader.readAsText(file)
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Owners equity — distribute retained earnings</p>
        <p className="mt-1 text-sm text-muted-foreground">
          After year-end close, profit sits in {retainedLabel} (
          <span className="font-medium tabular-nums text-foreground">{retainedBalance}</span>
          ). Export the owners list, fill Amount to allocate in Excel, then import once.
          {ownerCount === 0
            ? ' Add Owner\'s equity accounts on Chart of accounts first.'
            : ` ${ownerCount} owner account${ownerCount === 1 ? '' : 's'} on the chart.`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/api/exports/owners-equity"
          download
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          <DownloadIcon className="size-4" />
          Export owners list
        </a>
        {canImport ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || ownerCount === 0}
              onClick={() => inputRef.current?.click()}
            >
              {isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <UploadIcon className="size-4" />
              )}
              Import allocation
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
          </>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Import posts: Debit Retained Earnings · Credit each owner. Share % in the sheet is optional
        notes only — Amount to allocate is what posts.
      </p>
    </div>
  )
}
