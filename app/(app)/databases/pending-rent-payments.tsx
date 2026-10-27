'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { reviewRentPayment } from '@/app/(app)/billing/actions'
import { Button } from '@/components/ui/button'
import { RENT_METHOD_LABELS } from '@/lib/platform-billing-labels'
import { formatMoney } from '@/lib/money'
import type { PendingRentPaymentRow } from '@/server/services/platform-billing.service'

export function PendingRentPayments({ payments }: { payments: PendingRentPaymentRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (payments.length === 0) return null

  const confirm = (id: string) => {
    startTransition(async () => {
      const result = await reviewRentPayment({ id, decision: 'confirm' })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Payment confirmed — rent extended.')
      router.refresh()
    })
  }

  const reject = (id: string) => {
    startTransition(async () => {
      const result = await reviewRentPayment({ id, decision: 'reject' })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Payment rejected.')
      router.refresh()
    })
  }

  return (
    <section className="rounded-lg border border-emerald-500/40 bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Rent payments</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Companies submitted EVC / Zaad / bank proof. Confirm to extend rent and seats, or reject
          if the reference does not match.
        </p>
      </div>
      <ul className="divide-y divide-border">
        {payments.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{row.companyName}</p>
              <p className="text-xs text-muted-foreground">
                {row.planName} · {row.planMonths} mo · {formatMoney(row.amount, row.currency)}
                {row.planMaxUsers != null ? ` · ${row.planMaxUsers} seats` : ''}
              </p>
              <p className="mt-1 text-xs text-foreground">
                {RENT_METHOD_LABELS[row.method]} · ref {row.reference}
                {row.hasReceipt ? ' · receipt attached' : ''}
              </p>
              <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                {(row.submittedByName || row.submittedByEmail) ?? 'Someone'} ·{' '}
                {new Date(row.createdAt).toLocaleString()}
              </p>
              {row.notes ? (
                <p className="mt-1 text-xs text-muted-foreground">Note: {row.notes}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm" disabled={pending} onClick={() => confirm(row.id)}>
                <CheckIcon className="size-3.5" />
                Confirm
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => reject(row.id)}
              >
                <XIcon className="size-3.5" />
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
