import * as React from 'react'

import { cn } from '@/lib/utils'

function Table({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<'table'> & { containerClassName?: string }) {
  return (
    <div
      data-slot="table-container"
      className={cn('relative w-full max-w-full overflow-x-clip', containerClassName)}
    >
      <table
        data-slot="table"
        className={cn('w-full max-w-full table-fixed caption-bottom text-[0.8125rem]', className)}
        {...props}
      />
    </div>
  )
}

/**
 * Sticky column labels. While the sheet scrolls, the header stays put so you
 * can still read which figure (qty, price, account) each column is.
 */
function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        'sticky top-0 z-20 bg-[var(--band)] shadow-[inset_0_-1px_0_0_var(--border)]',
        '[&_tr]:border-b [&_th]:bg-[var(--band)]',
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
        'h-auto min-h-8 px-2 py-1.5 text-left align-top text-[0.6875rem] font-semibold uppercase tracking-wide text-foreground whitespace-normal break-words',
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
        'px-2 py-1.5 align-top break-words text-foreground [&:has([role=checkbox])]:pr-0 [&.numeric]:text-right',
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
