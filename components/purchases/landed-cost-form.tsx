'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { Field } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { allocateLandedCostForm } from '@/app/(app)/purchases/actions'
import { Decimal, formatMoney, parseMoneyInput, ZERO } from '@/lib/money'
import type { LandedCostPreview } from '@/server/services/landed-cost.service'

export function LandedCostForm({
  preview,
  currency,
}: {
  preview: LandedCostPreview
  currency: string
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(allocateLandedCostForm, idleState)
  const [memo, setMemo] = useState('')
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {}
    for (const row of preview.receipts) seed[row.itemId] = ''
    return seed
  })

  useEffect(() => {
    if (state.status === 'success') {
      toast.success(state.message ?? 'Allocated.')
      router.refresh()
    }
  }, [state, router])

  const remaining = new Decimal(preview.remaining)
  const total = useMemo(
    () =>
      Object.values(amounts).reduce((sum, value) => {
        const parsed = parseMoneyInput(value)
        return parsed ? sum.plus(parsed) : sum
      }, ZERO),
    [amounts],
  )

  const lines = preview.receipts
    .map((row) => {
      const parsed = parseMoneyInput(amounts[row.itemId] ?? '')
      if (!parsed || !parsed.isPositive()) return null
      return {
        itemId: row.itemId,
        storeId: row.storeId,
        amount: parsed.toFixed(4),
        quantity: row.lastReceiveQty,
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  const canPost = lines.length > 0 && total.greaterThan(0) && total.lessThanOrEqualTo(remaining)

  return (
    <form action={formAction} className="space-y-4">
      <FormStatus state={state} />
      <input type="hidden" name="billId" value={preview.bill.id} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <div className="grid gap-2 sm:grid-cols-3 text-sm">
        <p>
          Freight on bill <span className="tabular font-medium">{formatMoney(preview.pool, currency)}</span>
        </p>
        <p>
          Already allocated <span className="tabular font-medium">{formatMoney(preview.allocated, currency)}</span>
        </p>
        <p>
          Remaining <span className="tabular font-medium">{formatMoney(preview.remaining, currency)}</span>
        </p>
      </div>
      {preview.expenseAccountName ? (
        <p className="text-xs text-muted-foreground">
          Clearing from {preview.expenseAccountName}. Inventory asset is debited; this expense is credited.
        </p>
      ) : null}

      <Field name="memo" label="Memo">
        <Input value={memo} onChange={(event) => setMemo(event.target.value)} name="memo" placeholder="Duty, freight, landing" />
      </Field>

      {preview.receipts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recent inventory receives for this vendor or purchase order. Receive stock first, then allocate.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="text-right">Last receive</TableHead>
              <TableHead className="w-36 text-right">Allocate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.receipts.map((row) => (
              <TableRow key={row.itemId}>
                <TableCell>
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[row.sku, row.storeName].filter(Boolean).join(' · ') || '—'}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular">{row.onHand}</TableCell>
                <TableCell className="text-right tabular">
                  {row.lastReceiveQty}
                  {row.lastReceiveDate ? (
                    <span className="block text-xs text-muted-foreground">{row.lastReceiveDate}</span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Input
                    className="text-right"
                    inputMode="decimal"
                    value={amounts[row.itemId] ?? ''}
                    onChange={(event) =>
                      setAmounts((current) => ({ ...current, [row.itemId]: event.target.value }))
                    }
                    placeholder="0.00"
                    disabled={remaining.lte(0)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          This allocation <span className="tabular font-semibold">{formatMoney(total, currency)}</span>
          {total.greaterThan(remaining) ? (
            <span className="text-destructive"> — over remaining freight</span>
          ) : null}
        </p>
        <SubmitButton disabled={!canPost || remaining.lte(0)}>Allocate to receipts</SubmitButton>
      </div>
    </form>
  )
}
