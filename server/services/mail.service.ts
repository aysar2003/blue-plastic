import 'server-only'

import nodemailer from 'nodemailer'

import { openSecret, sealSecret } from '@/lib/sealed-secret'
import { env } from '@/lib/env'
import type { OutboundEmailInput } from '@/lib/validation/organization'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { precondition, validation } from '@/server/errors'

const SMTP_SELECT = {
  smtpHost: true,
  smtpPort: true,
  smtpSecure: true,
  smtpUser: true,
  smtpFrom: true,
  smtpPasswordSealed: true,
} as const

export type OrgSmtpPublic = {
  configured: boolean
  host: string | null
  port: number | null
  secure: boolean
  user: string | null
  from: string | null
  hasPassword: boolean
}

export type MailAttachment = {
  filename: string
  content: Buffer
  contentType?: string
}

function publicView(row: {
  smtpHost: string | null
  smtpPort: number | null
  smtpSecure: boolean
  smtpUser: string | null
  smtpFrom: string | null
  smtpPasswordSealed: string | null
}): OrgSmtpPublic {
  const hasPassword = Boolean(row.smtpPasswordSealed)
  const configured = Boolean(row.smtpHost && row.smtpUser && hasPassword && row.smtpPort)
  return {
    configured,
    host: row.smtpHost,
    port: row.smtpPort,
    secure: row.smtpSecure,
    user: row.smtpUser,
    from: row.smtpFrom ?? row.smtpUser,
    hasPassword,
  }
}

export async function getOutboundSettings(ctx: OrgContext): Promise<OrgSmtpPublic> {
  const row = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: SMTP_SELECT,
  })
  if (!row) {
    return {
      configured: false,
      host: null,
      port: null,
      secure: true,
      user: null,
      from: null,
      hasPassword: false,
    }
  }
  return publicView(row)
}

export async function updateOutboundSettings(ctx: OrgContext, input: OutboundEmailInput) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const before = await tx.organization.findUnique({
      where: { id: ctx.orgId },
      select: SMTP_SELECT,
    })
    if (!before) throw validation('Organisation not found.')

    if ('clear' in input && input.clear === true) {
      const after = await tx.organization.update({
        where: { id: ctx.orgId },
        data: {
          smtpHost: null,
          smtpPort: null,
          smtpSecure: true,
          smtpUser: null,
          smtpFrom: null,
          smtpPasswordSealed: null,
        },
        select: SMTP_SELECT,
      })
      await writeAudit(
        tx,
        ctx,
        {
          entity: 'Organization',
          entityId: ctx.orgId,
          action: 'UPDATE',
          before: { outboundEmail: publicView(before) },
          after: { outboundEmail: publicView(after) },
        },
        meta,
      )
      return publicView(after)
    }

    if (!('host' in input)) {
      throw validation('SMTP host is required.')
    }

    const password = input.password?.trim() ?? ''
    let sealed = before.smtpPasswordSealed
    if (password) {
      sealed = sealSecret(password, env.AUTH_SECRET)
    }
    if (!sealed) {
      throw validation('Enter the mailbox password (or App Password for Gmail).', {
        password: ['Password is required the first time you connect.'],
      })
    }

    const after = await tx.organization.update({
      where: { id: ctx.orgId },
      data: {
        smtpHost: input.host,
        smtpPort: input.port,
        smtpSecure: input.secure,
        smtpUser: input.user,
        smtpFrom: input.from ?? input.user,
        smtpPasswordSealed: sealed,
      },
      select: SMTP_SELECT,
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Organization',
        entityId: ctx.orgId,
        action: 'UPDATE',
        before: { outboundEmail: publicView(before) },
        after: { outboundEmail: publicView(after) },
      },
      meta,
    )
    return publicView(after)
  })
}

async function loadTransport(orgId: string) {
  const row = await db.organization.findUnique({
    where: { id: orgId },
    select: SMTP_SELECT,
  })
  if (!row?.smtpHost || !row.smtpPort || !row.smtpUser || !row.smtpPasswordSealed) {
    throw precondition(
      'Outgoing email is not connected. Open Settings → Organisation and add SMTP (Gmail or domain).',
    )
  }
  const password = openSecret(row.smtpPasswordSealed, env.AUTH_SECRET)
  if (!password) {
    throw precondition(
      'Saved email password could not be read. Re-enter the password in Settings → Organisation.',
    )
  }
  const from = (row.smtpFrom ?? row.smtpUser).trim()
  const transport = nodemailer.createTransport({
    host: row.smtpHost,
    port: row.smtpPort,
    secure: row.smtpSecure,
    auth: { user: row.smtpUser, pass: password },
  })
  return { transport, from, user: row.smtpUser }
}

function formatFromAddress(mailbox: string, fromName?: string | null): string {
  const address = mailbox.trim()
  const name = fromName?.trim()
  if (!name) return address
  // Quote display name so commas / special chars stay valid in From.
  const safe = name.replace(/"/g, '')
  return `"${safe}" <${address}>`
}

export async function sendOrgMail(
  ctx: OrgContext,
  input: {
    to: string
    subject: string
    text: string
    html?: string
    /** Shown as the From display name (sender). */
    fromName?: string | null
    attachments?: MailAttachment[]
  },
): Promise<{ messageId: string }> {
  const { transport, from } = await loadTransport(ctx.orgId)
  try {
    const info = await transport.sendMail({
      from: formatFromAddress(from, input.fromName),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    })
    return { messageId: info.messageId ?? '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Send failed'
    throw validation(`Email could not be sent: ${message}`)
  }
}

export async function sendTestMail(ctx: OrgContext, to: string): Promise<{ messageId: string }> {
  return sendOrgMail(ctx, {
    to,
    subject: 'SOM ERP — test email',
    text: 'Outgoing email is connected. You can send invoices, bills, and statements from the Email button.',
  })
}
