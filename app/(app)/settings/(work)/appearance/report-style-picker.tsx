'use client'

import { CheckIcon } from 'lucide-react'

import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import {
  parseReportStyle,
  REPORT_STYLE_KEY,
  REPORT_STYLES,
  type ReportStyleId,
} from '@/lib/report-styles'
import { cn } from '@/lib/utils'

export function ReportStylePicker() {
  const saved = useBrowserStore(REPORT_STYLE_KEY)
  const current = parseReportStyle(saved)

  const pick = (id: ReportStyleId) => {
    writeBrowserStore(REPORT_STYLE_KEY, id)
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {REPORT_STYLES.map((option) => {
        const active = current === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => pick(option.id)}
            className={cn(
              'rounded-xl border bg-card p-3 text-left transition-colors',
              active ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/40',
            )}
          >
            <span
              className="block overflow-hidden rounded-md border border-black/5"
              style={{
                fontFamily:
                  option.id === 'quickbooks'
                    ? 'var(--font-quickbooks), Arial, sans-serif'
                    : option.id === 'odoo'
                      ? 'var(--font-odoo), Inter, sans-serif'
                      : undefined,
              }}
              aria-hidden
            >
              <span
                className="flex h-7 items-center px-2 text-[0.65rem] font-semibold uppercase tracking-wide"
                style={{ background: option.swatches[1], color: '#1f2937' }}
              >
                Account
                <span className="ml-auto tabular">Amount</span>
              </span>
              <span className="flex h-6 items-center px-2 text-[0.65rem]" style={{ background: option.swatches[0] }}>
                <span
                  className="mr-1.5 size-1.5 shrink-0 rounded-full"
                  style={{ background: option.swatches[2] }}
                />
                Cash
                <span className="ml-auto tabular text-muted-foreground">1,200.00</span>
              </span>
              <span
                className="flex h-6 items-center px-2 text-[0.65rem]"
                style={{ background: option.swatches[1] }}
              >
                Bank
                <span className="ml-auto tabular text-muted-foreground">4,500.00</span>
              </span>
            </span>
            <span className="mt-3 flex items-center justify-between gap-2">
              <span className="font-medium">{option.label}</span>
              {active ? <CheckIcon className="size-4 text-primary" /> : null}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{option.blurb}</span>
          </button>
        )
      })}
    </div>
  )
}
