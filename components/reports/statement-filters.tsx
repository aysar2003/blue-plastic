'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Loader2Icon } from 'lucide-react'

import {
  STATEMENT_STATUSES,
  STATEMENT_STATUS_LABELS,
  STATEMENT_TYPES,
  STATEMENT_TYPE_LABELS,
  STATEMENT_TOTALS,
  STATEMENT_TOTALS_LABELS,
  STATEMENT_VIEWS,
  STATEMENT_VIEW_LABELS,
  type StatementStatus,
  type StatementTotals,
  type StatementView,
} from '@/lib/customer-statement'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

/**
 * Statement, type, and balance filters.
 *
 * They write to the URL beside the date range, so a detailed overdue statement
 * is a link someone else can open and get the same paper.
 */
export function StatementFilters({
  view,
  type,
  status,
  totals,
  typeOptions,
  defaultView = 'regular',
  invoiceView = false,
}: {
  view: StatementView
  type: string
  status: StatementStatus
  totals: StatementTotals
  /** When set, the type menu lists these instead of the customer types. */
  typeOptions?: { value: string; label: string }[]
  /** The view omitted from the URL, because it is what the page shows anyway. */
  defaultView?: StatementView
  /** Offer the invoice papers — each invoice, and the summary alone. Customers only. */
  invoiceView?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const set = (key: 'view' | 'type' | 'status' | 'totals', value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const isDefault = (key === 'view' && value === defaultView) || (key === 'totals' && value === 'line') || value === 'all'
    if (isDefault) params.delete(key)
    else params.set(key, value)
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  return (
    <div className="mb-4 space-y-3 print:hidden">
      <Filter label="Statement" pending={pending}>
        <div role="group" aria-label="Statement" className="flex flex-wrap gap-1.5">
          {STATEMENT_VIEWS.filter((key) => invoiceView || (key !== 'invoices' && key !== 'summary')).map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={view === key ? 'default' : 'outline'}
              aria-pressed={view === key}
              onClick={() => set('view', key)}
            >
              {STATEMENT_VIEW_LABELS[key]}
            </Button>
          ))}
        </div>
      </Filter>
      <div className="flex flex-wrap items-end gap-3">
        <Filter label="Type">
          <NativeSelect
            id="statement-type"
            className="w-44"
            value={type}
            onChange={(event) => set('type', event.target.value)}
          >
            {(typeOptions ?? STATEMENT_TYPES.map((key) => ({ value: key, label: STATEMENT_TYPE_LABELS[key] }))).map(
              (option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ),
            )}
          </NativeSelect>
        </Filter>
        <Filter label="Totals">
          <NativeSelect
            id="statement-totals"
            className="w-40"
            value={totals}
            onChange={(event) => set('totals', event.target.value)}
          >
            {STATEMENT_TOTALS.map((key) => (
              <option key={key} value={key}>
                {STATEMENT_TOTALS_LABELS[key]}
              </option>
            ))}
          </NativeSelect>
        </Filter>
        <Filter label="Balance">
          <NativeSelect
            id="statement-status"
            className="w-36"
            value={status}
            onChange={(event) => set('status', event.target.value)}
          >
            {STATEMENT_STATUSES.map((key) => (
              <option key={key} value={key}>
                {STATEMENT_STATUS_LABELS[key]}
              </option>
            ))}
          </NativeSelect>
        </Filter>
      </div>
    </div>
  )
}

function Filter({
  label,
  pending,
  children,
}: {
  label: string
  pending?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {pending ? <Loader2Icon className="ml-1.5 inline size-3 animate-spin" /> : null}
      </Label>
      {children}
    </div>
  )
}
