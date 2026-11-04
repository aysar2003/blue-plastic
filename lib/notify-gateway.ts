/**
 * Optional server-side SMS / WhatsApp send.
 * When no provider is configured, callers keep the existing wa.me fallback.
 */

export type NotifyChannel = 'whatsapp' | 'sms'

export type NotifySendResult =
  | { ok: true; via: 'whatsapp-cloud' | 'webhook' }
  | { ok: false; reason: 'not_configured' | 'no_phone' | 'send_failed'; detail?: string }

export function digitsPhone(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? digits : null
}

export function notifyGatewayConfigured(): boolean {
  return Boolean(
    process.env.NOTIFY_WEBHOOK_URL ||
      (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  )
}

export async function sendTextNotification(
  channel: NotifyChannel,
  to: string,
  text: string,
): Promise<NotifySendResult> {
  const phone = digitsPhone(to)
  if (!phone) return { ok: false, reason: 'no_phone' }

  const webhook = process.env.NOTIFY_WEBHOOK_URL?.trim()
  if (webhook) {
    try {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.NOTIFY_WEBHOOK_SECRET
            ? { authorization: `Bearer ${process.env.NOTIFY_WEBHOOK_SECRET}` }
            : {}),
        },
        body: JSON.stringify({ channel, to: phone, text }),
      })
      if (!response.ok) {
        return { ok: false, reason: 'send_failed', detail: `webhook ${response.status}` }
      }
      return { ok: true, via: 'webhook' }
    } catch (error) {
      return {
        ok: false,
        reason: 'send_failed',
        detail: error instanceof Error ? error.message : 'webhook failed',
      }
    }
  }

  const token = process.env.WHATSAPP_TOKEN?.trim()
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  if (channel === 'whatsapp' && token && phoneId) {
    try {
      const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: text.slice(0, 4096) },
        }),
      })
      if (!response.ok) {
        return { ok: false, reason: 'send_failed', detail: `cloud ${response.status}` }
      }
      return { ok: true, via: 'whatsapp-cloud' }
    } catch (error) {
      return {
        ok: false,
        reason: 'send_failed',
        detail: error instanceof Error ? error.message : 'cloud failed',
      }
    }
  }

  return { ok: false, reason: 'not_configured' }
}
