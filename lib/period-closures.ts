/** Closed / locked accounting spans shared by the periods board and report pickers. */

export type ClosureKind = 'month' | 'quarter' | 'year'

export type ClosureRow = {
  id: string
  kind: ClosureKind
  label: string
  fiscalYear: number
  /** 1–12 for months, 1–4 for quarters, null for a whole year. */
  sequence: number | null
  from: string
  to: string
  status: 'CLOSED' | 'LOCKED'
  closedAt: string | null
}
