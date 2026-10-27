import { toCalendarDate } from '@/lib/date'
import { STATUS_LABELS } from '@/lib/sales-types'

export type DocumentStamp = {
  createdBy?: string | null
  approvedBy?: string | null
  approvedAt?: Date | string | null
  status?: string | null
}

/** Bottom block on sales and purchase papers: who entered it, who approved it, when, and the status. */
export function documentStampLines(stamp: DocumentStamp): string[] {
  const status = stamp.status
    ? (STATUS_LABELS[stamp.status] ?? stamp.status).replaceAll('_', ' ')
    : '—'
  let approved = '—'
  if (stamp.approvedAt instanceof Date) approved = toCalendarDate(stamp.approvedAt)
  else if (typeof stamp.approvedAt === 'string' && stamp.approvedAt.trim()) {
    approved = stamp.approvedAt.slice(0, 10)
  }
  return [
    `Created By: ${stamp.createdBy?.trim() || '—'}`,
    `Approved By: ${stamp.approvedBy?.trim() || '—'}`,
    `Approved Date: ${approved}`,
    `Status: ${status}`,
  ]
}
