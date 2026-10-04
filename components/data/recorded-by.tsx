import { TableCell, TableHead } from '@/components/ui/table'
import { formatDateTime } from '@/lib/date'
import type { Trail } from '@/server/services/audit.service'

const VERB: Record<string, string> = {
  CREATE: 'Entered',
  UPDATE: 'Changed',
  POST: 'Posted',
  DELETE: 'Deleted',
  ARCHIVE: 'Archived',
  RESTORE: 'Restored',
  REVERSE: 'Reversed',
}

const verb = (action: string) => VERB[action] ?? 'Recorded'

/** The person who entered a record, and the person who last changed it. */
export function RecordedBy({ trail, timeZone }: { trail: Trail; timeZone: string }) {
  if (!trail.entered) {
    return <p className="mb-4 text-sm text-muted-foreground">No user is recorded on this entry.</p>
  }

  return (
    <p className="mb-4 rounded-lg border bg-card px-3 py-2 text-sm">
      <span className="text-muted-foreground">{verb(trail.entered.action)} by </span>
      <span className="font-medium">{trail.entered.name}</span>
      <span className="text-muted-foreground"> · {formatDateTime(trail.entered.at, timeZone)}</span>
      {trail.changed ? (
        <>
          <span className="text-muted-foreground"> · {verb(trail.changed.action)} by </span>
          <span className="font-medium">{trail.changed.name}</span>
          <span className="text-muted-foreground"> · {formatDateTime(trail.changed.at, timeZone)}</span>
        </>
      ) : null}
    </p>
  )
}

/** A sentence for a form: who entered the record, and who changed it when that is someone else. */
export function whoText(trail: Trail | undefined): string | null {
  if (!trail?.entered) return null
  if (trail.changed && trail.changed.name !== trail.entered.name) {
    return `Entered by ${trail.entered.name}. Last change by ${trail.changed.name}.`
  }
  return `Entered by ${trail.entered.name}.`
}

/** The person who entered a row, and who changed it later when that is someone else. */
export function enteredByLabel(trail: Trail | undefined): string {
  if (!trail?.entered) return '—'
  const later = trail.changed && trail.changed.name !== trail.entered.name
  return later && trail.changed ? `${trail.entered.name} · ${trail.changed.name}` : trail.entered.name
}

export function EnteredByHead() {
  return (
    <TableHead data-column="entered-by" className="w-44">
      Entered by
    </TableHead>
  )
}

export function EnteredByCell({ trail }: { trail: Trail | undefined }) {
  return <TableCell data-column="entered-by">{enteredByLabel(trail)}</TableCell>
}
