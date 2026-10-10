'use client'

import * as React from 'react'

import { DateField } from '@/components/ui/date-field'
import type { CalendarDate } from '@/lib/date'

/**
 * The orders filter sits on a dark panel. A native date box there draws
 * `dd----yyyy` and will not take a typed day. This one does: 10/10/2026,
 * 10/10, or 10. The calendar button is still there for picking.
 */
export function OrderDateField({
  id,
  name,
  label,
  defaultValue,
  today,
}: {
  id: string
  name: string
  label: string
  defaultValue: string
  today: CalendarDate
}) {
  const [value, setValue] = React.useState(defaultValue)

  return (
    <label className="block text-xs font-medium uppercase tracking-wide text-white/75">
      {label}
      <DateField
        id={id}
        name={name}
        value={value}
        onChange={setValue}
        today={today}
        placeholder="dd/mm/yyyy"
        className="mt-1 font-normal normal-case tracking-normal [&>div]:h-10 [&>div]:rounded-[0.65rem] [&_input]:text-sm"
      />
    </label>
  )
}
