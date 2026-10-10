'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { CalendarIcon } from 'lucide-react'

import { formatDate, isCalendarDate, type CalendarDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { Calendar } from './calendar'

const ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * A date input with a calendar attached.
 *
 * The box still takes typing — somebody entering forty bills does not want to
 * click through a grid forty times, and `04/03` is faster than finding the
 * fourth of March. The calendar is for the times you need to see where a date
 * falls: which day of the week, how far off the month end is.
 *
 * The value is always a `YYYY-MM-DD` string, which is what the whole system
 * stores and what a hidden input submits. What the box *shows* is the readable
 * form, so nobody has to read ISO dates all day.
 */
export function DateField({
  value,
  onChange,
  name,
  id,
  today,
  required,
  disabled,
  min,
  max,
  className,
  placeholder = 'Choose a date',
  'aria-invalid': invalid,
  'aria-describedby': describedBy,
}: {
  value: string
  onChange: (value: string) => void
  name?: string
  id?: string
  /** The organisation's today, so "today" is not the browser's timezone. */
  today?: CalendarDate
  required?: boolean
  disabled?: boolean
  min?: string
  max?: string
  className?: string
  placeholder?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [typed, setTyped] = React.useState<string | null>(null)

  const rootRef = React.useRef<HTMLDivElement>(null)
  const hiddenRef = React.useRef<HTMLInputElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = React.useState<{ top: number; left: number; above: boolean }>()

  const place = React.useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return

    const below = window.innerHeight - rect.bottom
    const above = below < 340 && rect.top > below
    setAnchor({ top: above ? rect.top - 4 : rect.bottom + 4, left: rect.left, above })
  }, [])

  React.useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }

    const onScroll = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node)) return
      place()
    }

    place()
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  /**
   * Accepts what people actually type: 2026-03-04, 04/03/2026, 4/3, or 4 for
   * the fourth of the month the value is already in. Anything unrecognised is
   * left alone, so a half-typed date is not thrown away mid-keystroke.
   */
  function parse(input: string): string | null {
    const text = input.trim()
    if (!text) return null
    // A plain test rather than the type guard: `CalendarDate` is an alias for
    // `string`, so narrowing on it would leave the else branch as `never`.
    if (ISO.test(text)) return text

    const base = (ISO.test(value) ? value : (today ?? '')) || new Date().toISOString().slice(0, 10)
    const parts = text.split(/[/.\-\s]+/).filter(Boolean).map(Number)
    if (parts.some(Number.isNaN)) return null

    const pad = (n: number) => String(n).padStart(2, '0')

    if (parts.length === 1) {
      return `${base.slice(0, 7)}-${pad(parts[0])}`
    }
    if (parts.length === 2) {
      return `${base.slice(0, 4)}-${pad(parts[1])}-${pad(parts[0])}`
    }
    const [day, month, year] = parts
    return `${year < 100 ? 2000 + year : year}-${pad(month)}-${pad(day)}`
  }

  function commit() {
    if (typed === null) return
    const text = typed.trim()
    setTyped(null)
    // Write the hidden field now. Apply is a click, and blur runs first — the
    // submitted value has to be the date just typed, not the one still in React.
    if (!text) {
      if (hiddenRef.current) hiddenRef.current.value = ''
      onChange('')
      return
    }
    const parsed = parse(text)
    if (parsed && isCalendarDate(parsed) && !Number.isNaN(Date.parse(parsed))) {
      if (hiddenRef.current) hiddenRef.current.value = parsed
      onChange(parsed)
    }
  }

  const display = typed ?? (isCalendarDate(value) ? formatDate(value) : '')

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {name ? (
        <input ref={hiddenRef} type="hidden" name={name} value={value} required={required} />
      ) : null}

      <div
        data-invalid={invalid ? 'true' : undefined}
        className={cn(
          'flex h-8 w-full items-center rounded-md border border-input bg-card transition-[color,box-shadow]',
          'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25',
          'data-[invalid=true]:border-destructive data-[invalid=true]:ring-destructive/20',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          aria-describedby={describedBy}
          aria-required={required}
          value={display}
          placeholder={placeholder}
          onChange={(event) => setTyped(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
              setOpen(false)
            } else if (event.key === 'Escape' && open) {
              event.preventDefault()
              setOpen(false)
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[0.8125rem] text-foreground outline-none placeholder:text-muted-foreground"
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? 'Close the calendar' : 'Open the calendar'}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          className="grid h-full w-8 shrink-0 place-items-center border-l text-muted-foreground"
        >
          <CalendarIcon className="size-3.5" />
        </button>
      </div>

      {open && anchor
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                position: 'fixed',
                top: anchor.above ? undefined : anchor.top,
                bottom: anchor.above ? window.innerHeight - anchor.top : undefined,
                left: anchor.left,
              }}
              className="pointer-events-auto z-[60] rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
            >
              <Calendar
                value={isCalendarDate(value) ? value : null}
                today={today}
                onSelect={(date) => {
                  if (min && date < min) return
                  if (max && date > max) return
                  onChange(date)
                  setOpen(false)
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
