import 'server-only'

import {
  digitsOnlyPhone,
  todoAssignmentBodyHtml,
  todoAssignmentBodyText,
  todoAssignmentSubject,
  todoAssignmentWhatsappText,
  todoWhatsappUrl,
  type TodoNotifyChannel,
  type TodoPriority,
} from '@/lib/todo-notify'
import { resolveSiteUrl } from '@/lib/site-url'
import type { CalendarDate } from '@/lib/date'
import type { OrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as mailService from '@/server/services/mail.service'

export type TodoNotifyResult = {
  channel: TodoNotifyChannel
  ok: boolean
  reason?:
    | 'whatsapp_not_enabled'
    | 'smtp_missing'
    | 'no_email'
    | 'send_failed'
    | 'no_phone'
  message?: string
  /** Present when WhatsApp is ready — client opens this wa.me link. */
  whatsappUrl?: string
}

export type DeliverTodoAssignmentInput = {
  todo: {
    title: string
    notes: string | null
    dueDate: CalendarDate | null
    priority: TodoPriority
  }
  assignee: {
    id: string
    name: string
    email: string
    phone?: string | null
  }
  channels: TodoNotifyChannel[]
}

/**
 * Notify an assignee that work was sent to them (Odoo-style).
 *
 * Email uses org SMTP (Settings → Organisation). Soft-fails so saving the
 * to-do is never blocked by mail issues.
 *
 * WhatsApp uses wa.me (same as document share). Returns a URL for the browser
 * to open — there is no server-side WhatsApp Business API yet.
 */
export async function deliverTodoAssignment(
  ctx: OrgContext,
  input: DeliverTodoAssignmentInput,
): Promise<TodoNotifyResult[]> {
  const results: TodoNotifyResult[] = []
  const todosUrl = `${resolveSiteUrl().origin}/todos`

  for (const channel of input.channels) {
    if (channel === 'email') {
      results.push(await sendAssignmentEmail(ctx, input, todosUrl))
      continue
    }
    if (channel === 'whatsapp') {
      results.push(buildAssignmentWhatsapp(ctx, input, todosUrl))
      continue
    }
  }
  return results
}

async function sendAssignmentEmail(
  ctx: OrgContext,
  input: DeliverTodoAssignmentInput,
  todosUrl: string,
): Promise<TodoNotifyResult> {
  const to = input.assignee.email?.trim()
  if (!to) {
    return {
      channel: 'email',
      ok: false,
      reason: 'no_email',
      message: 'Assignee has no email address.',
    }
  }

  const settings = await mailService.getOutboundSettings(ctx)
  if (!settings.configured) {
    return {
      channel: 'email',
      ok: false,
      reason: 'smtp_missing',
      message:
        'Saved, but email was not sent. Connect outgoing email in Settings → Organisation.',
    }
  }

  const mailInput = {
    orgName: ctx.organization.name,
    assignerName: ctx.user.name,
    assigneeName: input.assignee.name,
    title: input.todo.title,
    notes: input.todo.notes,
    dueDate: input.todo.dueDate,
    priority: input.todo.priority,
    todosUrl,
  }

  try {
    await mailService.sendOrgMail(ctx, {
      to,
      subject: todoAssignmentSubject(input.todo.title, ctx.organization.name),
      text: todoAssignmentBodyText(mailInput),
      html: todoAssignmentBodyHtml(mailInput),
      fromName: ctx.user.name,
    })
    return { channel: 'email', ok: true }
  } catch (error) {
    const message = isAppError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Email could not be sent.'
    if (isAppError(error) && error.code === 'PRECONDITION_FAILED') {
      return {
        channel: 'email',
        ok: false,
        reason: 'smtp_missing',
        message:
          'Saved, but email was not sent. Connect outgoing email in Settings → Organisation.',
      }
    }
    return {
      channel: 'email',
      ok: false,
      reason: 'send_failed',
      message: `Saved, but email was not sent: ${message}`,
    }
  }
}

function buildAssignmentWhatsapp(
  ctx: OrgContext,
  input: DeliverTodoAssignmentInput,
  todosUrl: string,
): TodoNotifyResult {
  const phone = digitsOnlyPhone(input.assignee.phone)
  if (!phone) {
    return {
      channel: 'whatsapp',
      ok: false,
      reason: 'no_phone',
      message:
        'Saved, but WhatsApp needs a number with country code (for example 25261…).',
    }
  }

  const text = todoAssignmentWhatsappText({
    orgName: ctx.organization.name,
    assignerName: ctx.user.name,
    assigneeName: input.assignee.name,
    title: input.todo.title,
    notes: input.todo.notes,
    dueDate: input.todo.dueDate,
    priority: input.todo.priority,
    todosUrl,
  })

  return {
    channel: 'whatsapp',
    ok: true,
    whatsappUrl: todoWhatsappUrl(phone, text),
  }
}
