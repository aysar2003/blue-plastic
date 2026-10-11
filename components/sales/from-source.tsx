'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { FileCheck2Icon, Loader2Icon, ReceiptIcon } from 'lucide-react'
import { toast } from 'sonner'

import { getConvertibleSource } from '@/app/(app)/sales/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/native-select'
import { formatDate, type CalendarDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { byType } from '@/lib/sales-types'
import type { SalesDocumentType } from '@prisma/client'

export type OpenSourceOption = {
  id: string
  type: SalesDocumentType
  number: string
  date: CalendarDate
  total: string
  customerId: string
  customerName: string
  lineCount: number
}

/** @deprecated Prefer OpenSourceOption. */
export type OpenQuotationOption = OpenSourceOption

export type PickedSourceLine = {
  itemId: string
  description: string
  quantity: string
  unitPrice: string
  discountPercent: string
  taxCodeId: string
  storeId: string
}

export type AppliedSource = {
  sourceId: string
  sourceNumber: string
  sourceType: SalesDocumentType
  reference: string | null
  memo: string | null
  customerMessage: string | null
  paymentTermId: string | null
  lines: PickedSourceLine[]
}

type SourceLineDetail = {
  id: string
  itemId: string | null
  itemName: string | null
  itemSku: string | null
  description: string | null
  quantity: string
  unitPrice: string
  discountPercent: string | null
  taxCodeId: string | null
  storeId: string | null
  amount: string
}

type SourceDetail = {
  id: string
  type: SalesDocumentType
  number: string
  reference: string | null
  memo: string | null
  customerMessage: string | null
  paymentTermId: string | null
  lines: SourceLineDetail[]
}

/**
 * QuickBooks Desktop-style: pick an open estimate / quotation / order, tick the
 * lines to bring across, Done fills the invoice (or receipt) form — you save.
 */
export function FromSourcePicker({
  customerId,
  sources,
  currency,
  target,
  onApply,
}: {
  customerId: string
  sources: OpenSourceOption[]
  today: string
  currency: string
  target: 'INVOICE' | 'SALES_RECEIPT'
  depositAccounts?: unknown
  onApply: (applied: AppliedSource) => void
}) {
  const [selectedId, setSelectedId] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detail, setDetail] = useState<SourceDetail | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [isPending, startTransition] = useTransition()

  const forCustomer = useMemo(
    () => sources.filter((row) => row.customerId === customerId),
    [sources, customerId],
  )

  useEffect(() => {
    setSelectedId('')
    setDialogOpen(false)
    setDetail(null)
  }, [customerId])

  if (!customerId || forCustomer.length === 0) return null

  const selected = forCustomer.find((row) => row.id === selectedId)
  const heading =
    target === 'INVOICE'
      ? 'Create from estimate, quotation, or order'
      : 'Create from open document'
  const openLabel = target === 'INVOICE' ? 'Choose items…' : 'Choose items…'
  const doneLabel = target === 'INVOICE' ? 'Add to invoice' : 'Add to sales receipt'

  const openPicker = () => {
    if (!selected) return
    startTransition(async () => {
      const result = await getConvertibleSource({ id: selected.id })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      const data = result.data
      const initial: Record<string, boolean> = {}
      for (const line of data.lines) initial[line.id] = true
      setDetail(data)
      setChecked(initial)
      setDialogOpen(true)
    })
  }

  const selectedCount = detail ? detail.lines.filter((line) => checked[line.id]).length : 0
  const allOn = detail ? detail.lines.length > 0 && detail.lines.every((line) => checked[line.id]) : false

  const apply = () => {
    if (!detail) return
    const picked = detail.lines.filter((line) => checked[line.id])
    if (picked.length === 0) {
      toast.error('Tick at least one item to bring across.')
      return
    }
    onApply({
      sourceId: detail.id,
      sourceNumber: detail.number,
      sourceType: detail.type,
      reference: detail.reference,
      memo: detail.memo,
      customerMessage: detail.customerMessage,
      paymentTermId: detail.paymentTermId,
      lines: picked.map((line) => ({
        itemId: line.itemId ?? '',
        description: line.description ?? line.itemName ?? '',
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent ?? '',
        taxCodeId: line.taxCodeId ?? '',
        storeId: line.storeId ?? '',
      })),
    })
    setDialogOpen(false)
    toast.success(
      `${picked.length} ${picked.length === 1 ? 'line' : 'lines'} from ${detail.number} added. Save when ready.`,
    )
  }

  return (
    <>
      <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-3">
        <p className="text-sm font-medium">{heading}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick the document, then tick the items to bring onto this form — like QuickBooks Desktop.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <label htmlFor="fromSource" className="mb-1 block text-xs font-medium text-muted-foreground">
              Open document
            </label>
            <NativeSelect
              id="fromSource"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              disabled={isPending}
            >
              <option value="">Choose…</option>
              {forCustomer.map((row) => (
                <option key={row.id} value={row.id}>
                  {byType(row.type).singular} {row.number} · {formatDate(row.date)} ·{' '}
                  {formatMoney(row.total, currency)} · {row.lineCount}{' '}
                  {row.lineCount === 1 ? 'line' : 'lines'}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="button" size="sm" disabled={!selected || isPending} onClick={openPicker}>
            {isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : target === 'SALES_RECEIPT' ? (
              <ReceiptIcon />
            ) : (
              <FileCheck2Icon />
            )}
            {openLabel}
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>
              {detail
                ? `Items from ${byType(detail.type).singular.toLowerCase()} ${detail.number}`
                : 'Choose items'}
            </DialogTitle>
            <DialogDescription>
              Tick the lines to put on this {target === 'INVOICE' ? 'invoice' : 'sales receipt'}. You
              can change quantities after they appear on the form, then save.
            </DialogDescription>
          </DialogHeader>

          {detail ? (
            <div className="max-h-[min(24rem,50vh)] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={allOn}
                        onChange={() => {
                          const next = !allOn
                          const map: Record<string, boolean> = {}
                          for (const line of detail.lines) map[line.id] = next
                          setChecked(map)
                        }}
                        aria-label="Select all lines"
                        className="size-3.5 accent-[#2ca01c]"
                      />
                    </th>
                    <th className="px-2 py-2 font-medium">Item</th>
                    <th className="w-20 px-2 py-2 text-right font-medium">Qty</th>
                    <th className="w-28 px-2 py-2 text-right font-medium">Rate</th>
                    <th className="w-28 px-2 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((line) => {
                    const label =
                      line.description ||
                      line.itemName ||
                      (line.itemSku ? `SKU ${line.itemSku}` : 'Line')
                    return (
                      <tr key={line.id} className="border-t">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={Boolean(checked[line.id])}
                            onChange={() =>
                              setChecked((current) => ({
                                ...current,
                                [line.id]: !current[line.id],
                              }))
                            }
                            aria-label={`Include ${label}`}
                            className="size-3.5 accent-[#2ca01c]"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <span className="block font-medium">{label}</span>
                          {line.itemName && line.description && line.itemName !== line.description ? (
                            <span className="block text-xs text-muted-foreground">{line.itemName}</span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-right tabular">{Number(line.quantity)}</td>
                        <td className="px-2 py-2 text-right tabular">
                          {formatMoney(line.unitPrice, currency)}
                        </td>
                        <td className="px-2 py-2 text-right tabular">
                          {formatMoney(line.amount, currency)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <DialogFooter>
            <p className="mr-auto text-sm text-muted-foreground">
              {selectedCount} of {detail?.lines.length ?? 0} selected
            </p>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={selectedCount === 0} onClick={apply}>
              {doneLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** @deprecated Prefer FromSourcePicker. */
export function FromQuotationPicker({
  customerId,
  quotations,
  today,
  currency,
}: {
  customerId: string
  quotations: OpenSourceOption[]
  today: string
  currency: string
}) {
  return (
    <FromSourcePicker
      customerId={customerId}
      sources={quotations}
      today={today}
      currency={currency}
      target="INVOICE"
      onApply={() => undefined}
    />
  )
}
