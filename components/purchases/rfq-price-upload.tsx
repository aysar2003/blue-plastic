'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2Icon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'

import { importRfqPrices } from '@/app/(app)/purchases/actions'
import { Button } from '@/components/ui/button'

/** Upload the RFQ workbook after the supplier has filled the Rate column. */
export function RfqPriceUpload({ id }: { id: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  return (
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
        variant="outline"
        disabled={isPending}
        title="Upload the Excel you sent, with the supplier's prices in Rate"
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
        Upload prices
      </Button>
    </>
  )
}
