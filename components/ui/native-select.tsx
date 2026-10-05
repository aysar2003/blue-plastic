import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * A styled `<select>`.
 *
 * Ten screens each declared the same class string. This is that string, once.
 *
 * It stays a native select on purpose: for a short, fixed list — a payment
 * method, a filing frequency — the platform control is faster to use, works on a
 * phone, and needs no JavaScript. The searchable combobox is for lists of
 * records, which are long and change.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'flex h-8 w-full rounded-md border border-input bg-card px-2.5 text-[0.8125rem] transition-[color,box-shadow] outline-none caret-foreground',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { NativeSelect }
