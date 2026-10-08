'use client'

import { type ReactNode } from 'react'
import { PanelRightCloseIcon } from 'lucide-react'

import { useOptionalContactDetailPanel } from '@/components/contacts/contact-split'
import { cn } from '@/lib/utils'

/**
 * Customer / vendor information header. The close control hides the whole
 * detail pane so the name list expands — QuickBooks-style.
 */
export function CollapsibleProfile({
  title,
  headerExtra,
  children,
}: {
  title: string
  headerExtra?: ReactNode
  /** @deprecated Detail open state lives on ContactSplit. */
  storageKey?: string
  children: ReactNode
  empty?: ReactNode
}) {
  const detail = useOptionalContactDetailPanel()

  return (
    <div className="border-b">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {detail ? (
            <button
              type="button"
              onClick={detail.hide}
              className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-expanded={detail.open}
              aria-label="Hide information"
              title="Hide information"
            >
              <PanelRightCloseIcon className="size-4" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-lg font-semibold">{title}</h1>
              {headerExtra ? (
                <div className="flex shrink-0 items-center [&>div]:flex-row [&>div]:gap-1">{headerExtra}</div>
              ) : null}
            </div>
            <div className="mt-3">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProfileFieldGrid({
  company,
  fullName,
  billTo,
  phone,
  workPhone,
  className,
}: {
  company: string
  fullName: string
  billTo: string[]
  phone: string | null
  workPhone: string | null
  className?: string
}) {
  return (
    <dl className={cn('grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2', className)}>
      <div>
        <dt className="text-xs text-muted-foreground">Company name</dt>
        <dd>{company}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Main phone</dt>
        <dd>{phone ?? '—'}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Full name</dt>
        <dd className="uppercase">{fullName}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Work phone</dt>
        <dd>{workPhone ?? '—'}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-xs text-muted-foreground">Bill to</dt>
        <dd>{billTo.length > 0 ? billTo.join(', ') : '—'}</dd>
      </div>
    </dl>
  )
}
