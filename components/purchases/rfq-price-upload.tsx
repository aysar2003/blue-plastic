'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileSpreadsheetIcon, Loader2Icon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'

import { importRfqPrices } from '@/app/(app)/purchases/actions'
import { Button } from '@/components/ui/button'

/** Upload the RFQ workbook after the supplier has filled the Rate column. */
export function RfqPriceUpload({ id, compact }: { id: string; compact?: boolean }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  const picker = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            const payload = String(reader.result ?? '')
            const workbook = payload.slice(payload.indexOf(',') + 1)
            startTransition(async () => {
              const result = await importRfqPrices({ id, workbook })
              if (!result.ok) {
                toast.error(result.error.message)
                return
              }
              const skipped = result.data.skipped
              toast.success(
                `${result.data.updated} price${result.data.updated === 1 ? '' : 's'} saved on this RFQ` +
                  (skipped > 0 ? ` · ${skipped} row${skipped === 1 ? '' : 's'} did not match` : ''),
              )
              router.refresh()
            })
          }
          reader.readAsDataURL(file)
        }}
      />
      <Button
        type="button"
        size="sm"
        variant={compact ? 'outline' : 'default'}
        disabled={isPending}
        title="Upload the Excel you sent, with the supplier's prices in Rate"
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
        Upload prices
      </Button>
    </>
  )

  if (compact) return picker

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <FileSpreadsheetIcon className="size-3.5 text-muted-foreground" aria-hidden />
            Vendor prices (Excel)
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Download Excel, fill the Rate column, then upload the same .xlsx here — not under
            Attachments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <a
            href={`/api/purchases/${id}/xlsx`}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <FileSpreadsheetIcon className="size-3.5" aria-hidden />
            Download Excel
          </a>
          {picker}
        </div>
      </div>
    </section>
  )
}
