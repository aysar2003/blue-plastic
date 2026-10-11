import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Data table. By default the sheet is its own scroll pane: column names stick
 * to the top while you scroll the rows (registers, sales lists, reports).
 * Pass `embed` for a compact table inside a form or dialog that should not
 * claim the viewport.
 */
function Table({
  className,
  containerClassName,
  embed = false,
  ...props
}: React.ComponentProps<'table'> & {
  containerClassName?: string
  /** Skip the sticky scroll pane — use inside forms, dialogs, and nested sheets. */
  embed?: boolean
}) {
  return (
    <div
      data-slot="table-container"
      {...(embed ? {} : { 'data-table-scroll': '' })}
      className={cn(
        'relative w-full max-w-full',
        embed
          ? 'overflow-x-auto'
          : 'sticky top-0 z-20 max-h-dvh overflow-auto overscroll-contain',
        containerClassName,
      )}
    >
      <table
        data-slot="table"
        className={cn('w-full max-w-full caption-bottom text-[0.8125rem]', className)}
        {...props}
      />
    </div>
  )
}

/**
 * Column labels. Stickiness lives on each `th` — Chrome ignores `position: sticky`
 * on `thead` / `tr`, so the names would scroll away even with it set here.
 */
function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        /* --report-head-* when inside a report; otherwise the theme band. */
        'bg-[var(--report-head-bg,var(--band))] text-[var(--report-head-fg,var(--foreground))] shadow-[inset_0_-1px_0_0_var(--border)]',
        '[&_tr]:border-b [&_th]:bg-[var(--report-head-bg,var(--band))] [&_th]:text-[var(--report-head-fg,var(--foreground))]',
        className,
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t bg-muted/60 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b transition-colors hover:bg-accent/40 data-[state=selected]:bg-accent/60',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        /* text-inherit: follow thead / --report-head-fg, never fight a dark bar. */
        /* sticky on the cell, not thead: that is what actually pins the name while scrolling. */
        'sticky top-0 z-30 h-auto min-h-8 bg-[var(--report-head-bg,var(--band))] px-2 py-1.5 text-left align-middle text-[0.6875rem] font-semibold uppercase tracking-wide text-inherit whitespace-nowrap shadow-[0_1px_0_var(--border)]',
        '[&:has([role=checkbox])]:pr-0 [&.numeric]:text-right',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'px-2 py-1.5 align-middle whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&.numeric]:text-right',
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return <caption data-slot="table-caption" className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
}

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption }
