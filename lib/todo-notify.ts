import { formatDate, type CalendarDate } from '@/lib/date'

export const TODO_PRIORITIES = [0, 1, 2] as const
export type TodoPriority = (typeof TODO_PRIORITIES)[number]

export const TODO_PRIORITY_LABELS: Record<TodoPriority, string> = {
  0: 'Normal',
  1: 'Important',
  2: 'Urgent',
}

export type TodoNotifyChannel = 'email' | 'whatsapp'

export type TodoAssignmentMailInput = {
  orgName: string
  assignerName: string
  assigneeName: string
  title: string
  notes: string | null
  dueDate: CalendarDate | null
  priority: TodoPriority
  todosUrl: string
}

/** Subject line for an assigned to-do email. */
export function todoAssignmentSubject(title: string, orgName: string): string {
  const clean = title.trim() || 'To-do'
  return `To-do: ${clean} — ${orgName.trim() || 'SOM ERP'}`
}

/** Plain-text body for an assigned to-do email. */
export function todoAssignmentBodyText(input: TodoAssignmentMailInput): string {
  const lines = [
    `Hi ${input.assigneeName.trim() || 'there'},`,
    '',
    `${input.assignerName.trim() || 'Someone'} assigned you a to-do in ${input.orgName.trim() || 'SOM ERP'}.`,
    '',
    `Task: ${input.title.trim()}`,
  ]
  if (input.priority > 0) {
    lines.push(`Priority: ${TODO_PRIORITY_LABELS[input.priority]}`)
  }
  if (input.dueDate) {
    lines.push(`Deadline: ${formatDate(input.dueDate)}`)
  }
  if (input.notes?.trim()) {
    lines.push('', 'Notes:', input.notes.trim())
  }
  lines.push('', `Open your list: ${input.todosUrl}`, '', '— SOM ERP')
  return lines.join('\n')
}

/** Simple HTML body (mirrors plain text). */
export function todoAssignmentBodyHtml(input: TodoAssignmentMailInput): string {
  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const rows: string[] = [
    `<p style="margin:0 0 12px">Hi ${escape(input.assigneeName.trim() || 'there')},</p>`,
    `<p style="margin:0 0 12px">${escape(input.assignerName.trim() || 'Someone')} assigned you a to-do in <strong>${escape(input.orgName.trim() || 'SOM ERP')}</strong>.</p>`,
    `<p style="margin:0 0 8px"><strong>Task:</strong> ${escape(input.title.trim())}</p>`,
  ]
  if (input.priority > 0) {
    rows.push(
      `<p style="margin:0 0 8px"><strong>Priority:</strong> ${escape(TODO_PRIORITY_LABELS[input.priority])}</p>`,
    )
  }
  if (input.dueDate) {
    rows.push(
      `<p style="margin:0 0 8px"><strong>Deadline:</strong> ${escape(formatDate(input.dueDate))}</p>`,
    )
  }
  if (input.notes?.trim()) {
    rows.push(
      `<p style="margin:12px 0 4px"><strong>Notes:</strong></p>`,
      `<p style="margin:0 0 12px;white-space:pre-wrap">${escape(input.notes.trim())}</p>`,
    )
  }
  rows.push(
    `<p style="margin:16px 0 0"><a href="${escape(input.todosUrl)}">Open your to-do list</a></p>`,
    `<p style="margin:16px 0 0;color:#64748b;font-size:12px">— SOM ERP</p>`,
  )
  return `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2933">${rows.join('')}</div>`
}

/** Digits only for wa.me — strips spaces, +, and punctuation. */
export function digitsOnlyPhone(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  return digits.length >= 8 ? digits : null
}

/** Short WhatsApp chat text for an assigned to-do (same facts as the email). */
export function todoAssignmentWhatsappText(input: TodoAssignmentMailInput): string {
  const lines = [
    `To-do from ${input.assignerName.trim() || 'someone'} (${input.orgName.trim() || 'SOM ERP'})`,
    input.title.trim(),
  ]
  if (input.priority > 0) lines.push(`Priority: ${TODO_PRIORITY_LABELS[input.priority]}`)
  if (input.dueDate) lines.push(`Deadline: ${formatDate(input.dueDate)}`)
  if (input.notes?.trim()) lines.push(input.notes.trim())
  lines.push(input.todosUrl)
  return lines.join('\n')
}

/** Client opens this URL (same pattern as document WhatsApp share). */
export function todoWhatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}
