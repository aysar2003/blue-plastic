import 'server-only'

import nodemailer from 'nodemailer'

import { env } from '@/lib/env'
import { PRODUCT_NAME } from '@/lib/product-brand'
import { openSecret } from '@/lib/sealed-secret'
import { db } from '@/server/db'

type SmtpTransport = {
  transport: nodemailer.Transporter
  from: string
  source: string
}

async function platformEnvTransport(): Promise<SmtpTransport | null> {
  const host = env.AUTH_SMTP_HOST
  const user = env.AUTH_SMTP_USER
  const pass = env.AUTH_SMTP_PASS
  const from = env.AUTH_SMTP_FROM ?? user
  if (!host || !user || !pass || !from) return null

  const port = env.AUTH_SMTP_PORT ?? 465
  const secure = env.AUTH_SMTP_SECURE ?? port === 465
  return {
    source: 'AUTH_SMTP',
    from,
    transport: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    }),
  }
}

/** Prefer AL FURAAT / matching mailbox, else any org with Settings → Outgoing email. */
async function orgSmtpTransport(): Promise<SmtpTransport | null> {
  const rows = await db.organization.findMany({
    where: {
      smtpHost: { not: null },
      smtpUser: { not: null },
      smtpPasswordSealed: { not: null },
      smtpPort: { not: null },
    },
    select: {
      id: true,
      name: true,
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      smtpUser: true,
      smtpFrom: true,
      smtpPasswordSealed: true,
    },
    orderBy: { name: 'asc' },
    take: 20,
  })
  if (rows.length === 0) return null

  const preferred =
    rows.find((row) => /furaat/i.test(row.name)) ??
    rows.find((row) => /aysaryare|alfuraat|gmail/i.test(row.smtpUser ?? '')) ??
    rows[0]!

  const password = openSecret(preferred.smtpPasswordSealed!, env.AUTH_SECRET)
  if (!password) return null

  const from = (preferred.smtpFrom ?? preferred.smtpUser)!.trim()
  return {
    source: `org:${preferred.name}`,
    from,
    transport: nodemailer.createTransport({
      host: preferred.smtpHost!,
      port: preferred.smtpPort!,
      secure: preferred.smtpSecure,
      auth: { user: preferred.smtpUser!, pass: password },
    }),
  }
}

/**
 * Platform-level notify for auth OTP.
 * Uses AUTH_SMTP_* when set; otherwise reuses a company Outgoing email
 * (Settings → Organisation) — typically AL FURAAT Gmail App Password.
 */
export async function sendAuthEmailOtp(to: string, code: string): Promise<void> {
  const subject = `${PRODUCT_NAME} sign-in code`
  const text = `Your ${PRODUCT_NAME} verification code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`

  // Always surface the code in local/dev so owner/staff can sign in even if mail lags.
  if (env.NODE_ENV !== 'production') {
    console.info(`[auth-otp] ${to} → ${code}`)
  }

  const smtp = (await platformEnvTransport()) ?? (await orgSmtpTransport())
  if (!smtp) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        'No mail transport for login codes. Set AUTH_SMTP_* or connect Outgoing email on a company.',
      )
    }
    return
  }

  const send = smtp.transport.sendMail({ from: smtp.from, to, subject, text })
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Auth SMTP timed out after 8s.')), 8_000)
  })
  try {
    await Promise.race([send, timeout])
    if (env.NODE_ENV !== 'production') {
      console.info(`[auth-otp] sent via ${smtp.source} → ${to}`)
    }
  } catch (error) {
    console.error(`[auth-otp] send failed via ${smtp.source}`, error)
    if (env.NODE_ENV === 'production') throw error
    // Dev: code already logged above — do not block sign-in UI.
  }
}

/** SMS / WhatsApp OTP when NOTIFY_WEBHOOK_URL or WhatsApp Cloud is configured. */
export async function sendAuthSmsOtp(to: string, code: string): Promise<void> {
  const { sendTextNotification } = await import('@/lib/notify-gateway')
  const sent = await sendTextNotification(
    'sms',
    to,
    `Your ${PRODUCT_NAME} verification code is ${code}. It expires in 10 minutes.`,
  )
  if (sent.ok) return
  if (env.NODE_ENV !== 'production') {
    console.info('[auth-otp] SMS not configured — email OTP is used when enabled.')
  }
}
