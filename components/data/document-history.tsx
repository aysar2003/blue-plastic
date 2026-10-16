import { formatDateTime } from '@/lib/date'
import type { TrailEvent } from '@/server/services/audit.service'

/**
 * Who changed this record, and when — the audit events that belong to one
 * document, not the organisation-wide Trash list (Phase 11.9).
 */
export function DocumentHistory({
  events,
  timeZone,
}: {
  events: TrailEvent[]
  timeZone: string
}) {
  if (events.length === 0) return null

  return (
    <section className="mt-8 rounded-xl border border-border bg-card p-3 print:hidden">
      <h2 className="text-sm font-semibold">Change history</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Who entered or changed this record. Deletions stay in Trash.
      </p>
      <ol className="mt-3 space-y-2">
        {events.map((event, index) => (
          <li
            key={`${event.at.toISOString()}-${event.action}-${index}`}
            className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-2 text-sm first:border-t-0 first:pt-0"
          >
            <span>
              <span className="font-medium text-foreground">{event.name}</span>
              <span className="text-muted-foreground"> · {labelFor(event.action)}</span>
            </span>
            <span className="tabular text-xs text-muted-foreground">
              {formatDateTime(event.at, timeZone)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function labelFor(action: string) {
  switch (action) {
    case 'CREATE':
      return 'created'
    case 'UPDATE':
      return 'changed'
    case 'POST':
      return 'posted'
    case 'DELETE':
      return 'deleted'
    case 'ARCHIVE':
      return 'archived'
    case 'RESTORE':
      return 'restored'
    case 'REVERSE':
      return 'reversed'
    default:
      return action.toLowerCase()
  }
}
