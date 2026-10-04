'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileCheck2Icon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { convertEstimate } from '@/app/(app)/sales/actions'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { formatDate, type CalendarDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'

export type OpenQuotationOption = {
  id: string
  number: string
  date: CalendarDate
  total: string
  customerId: string
  customerName: string
  lineCount: number
}

/**
 * On a new invoice, pick an open quotation for the chosen customer and turn it
 * into this invoice — same items and prices, no retyping.
 */
export function FromQuotationPicker({
  customerId,
  quotations,
  today,
  currency,
}: {
  customerId: string
  quotations: OpenQuotationOption[]
  today: string
  currency: string
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState('')
  const [isPending, startTransition] = useTransition()

  const forCustomer = useMemo(
    () => quotations.filter((row) => row.customerId === customerId),
    [quotations, customerId],
  )

  if (!customerId || forCustomer.length === 0) return null

  const selected = forCustomer.find((row) => row.id === selectedId)

  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-3">
      <p className="text-sm font-medium">Create from quotation</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Use the items and prices already quoted — no need to type them again.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <label htmlFor="fromQuotation" className="mb-1 block text-xs font-medium text-muted-foreground">
            Open quotation
          </label>
          <NativeSelect
            id="fromQuotation"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={isPending}
          >
            <option value="">Choose a quotation…</option>
            {forCustomer.map((row) => (
              <option key={row.id} value={row.id}>
                {row.number} · {formatDate(row.date)} · {formatMoney(row.total, currency)} ·{' '}
                {row.lineCount} {row.lineCount === 1 ? 'line' : 'lines'}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!selected || isPending}
          onClick={() => {
            if (!selected) return
            startTransition(async () => {
              const result = await convertEstimate({ id: selected.id, date: today })
              if (result.ok) {
                toast.success(`Invoice ${result.data.number} created from ${selected.number}.`)
                router.push(`/sales/invoices/${result.data.id}`)
                router.refresh()
              } else {
                toast.error(result.error.message)
              }
            })
          }}
        >
          {isPending ? <Loader2Icon className="animate-spin" /> : <FileCheck2Icon />}
          Create invoice
        </Button>
      </div>
    </div>
  )
}
