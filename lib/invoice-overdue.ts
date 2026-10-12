import type { CalendarDate } from '@/lib/date'

/**
 * Collection due date for overdue checks.
 *
 * A payment promise (promisedDate) replaces the original due date until it
 * itself passes. Original dueDate stays on the invoice for the books.
 */
export function collectionDueDate(row: {
  dueDate?: CalendarDate | Date | null
  promisedDate?: CalendarDate | Date | null
  due?: CalendarDate | null
  date?: CalendarDate | Date | null
}): CalendarDate | null {
  const promised = toIso(row.promisedDate)
  if (promised) return promised
  const due = toIso(row.dueDate) ?? row.due ?? null
  if (due) return due
  return toIso(row.date)
}

/** True when an open invoice should appear on overdue lists and the overdue band. */
export function isCollectionOverdue(
  row: {
    status?: string
    excludeFromOverdue?: boolean | null
    dueDate?: CalendarDate | Date | null
    promisedDate?: CalendarDate | Date | null
    due?: CalendarDate | null
    date?: CalendarDate | Date | null
  },
  asOf: CalendarDate,
): boolean {
  if (row.excludeFromOverdue) return false
  if (row.status && row.status !== 'OPEN' && row.status !== 'PARTIAL') return false
  const due = collectionDueDate(row)
  return Boolean(due && due < asOf)
}

function toIso(value: CalendarDate | Date | null | undefined): CalendarDate | null {
  if (!value) return null
  if (typeof value === 'string') return value
  return value.toISOString().slice(0, 10)
}
