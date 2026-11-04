import 'server-only'

import nodemailer from 'nodemailer'

import { env } from '@/lib/env'
import { PRODUCT_NAME } from '@/lib/product-brand'

/**
 * Platform-level notify for auth OTP. Separate from per-company document SMTP.
 * SMS/WhatsApp: optional webhook or WhatsApp Cloud via lib/notify-gateway.
 */
export async function sendAuthEmailOtp(to: string, code: string): Promise<void> {
  const subject = `${PRODUCT_NAME} sign-in code`
  const text = `Your ${PRODUCT_NAME} verification code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`

  const host = env.AUTH_SMTP_HOST
  const user = env.AUTH_SMTP_USER
  const pass = env.AUTH_SMTP_PASS
  const from = env.AUTH_SMTP_FROM ?? user

  if (!host || !user || !pass || !from) {
    if (env.NODE_ENV === 'production') {
      throw new Error('AUTH_SMTP_* is not configured — cannot send login codes.')
    }
    console.info(`[auth-otp] ${to} → ${code}`)
    return
  }

  const port = env.AUTH_SMTP_PORT ?? 465
  const secure = env.AUTH_SMTP_SECURE ?? port === 465
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })

  await transport.sendMail({ from, to, subject, text })
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
