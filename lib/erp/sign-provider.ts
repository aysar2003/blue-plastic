import { createHmac, timingSafeEqual } from 'node:crypto'

export type SignProviderConfig = {
  kind: 'native' | 'webhook'
  webhookUrl?: string
  webhookSecret?: string
}

export function parseSignProvider(raw: unknown): SignProviderConfig {
  if (!raw || typeof raw !== 'object') return { kind: 'native' }
  const row = raw as Record<string, unknown>
  const kind = row.kind === 'webhook' ? 'webhook' : 'native'
  const webhookUrl = typeof row.webhookUrl === 'string' ? row.webhookUrl.trim() : undefined
  const webhookSecret =
    typeof row.webhookSecret === 'string' ? row.webhookSecret.trim() || undefined : undefined
  return kind === 'webhook' && webhookUrl ? { kind, webhookUrl, webhookSecret } : { kind: 'native' }
}

export type SignWebhookPayload = {
  requestId: string
  title: string
  token: string | null
  signerEmail: string | null
  organizationName: string
}

/** HMAC-SHA256 hex digest for outbound sign webhooks (Phase 59 deepen). */
export function signWebhookBody(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

/** Verify inbound `X-Som-Signature` against the raw JSON body. */
export function verifySignWebhookSignature(secret: string, body: string, header: string | null): boolean {
  if (!header?.trim()) return false
  const expected = signWebhookBody(secret, body)
  const provided = header.trim().replace(/^sha256=/i, '')
  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(provided, 'hex')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return expected === provided
  }
}

/** POST stub; returns external id when webhook accepts. Failures do not throw. */
export async function dispatchSignWebhook(
  config: SignProviderConfig,
  payload: SignWebhookPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<{ externalId: string | null; ok: boolean; error?: string }> {
  if (config.kind !== 'webhook' || !config.webhookUrl) {
    return { externalId: null, ok: true }
  }
  const body = JSON.stringify({
    event: 'sign.request.sent',
    ...payload,
  })
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (config.webhookSecret) {
    headers['X-Som-Signature'] = signWebhookBody(config.webhookSecret, body)
  }
  try {
    const res = await fetchImpl(config.webhookUrl, {
      method: 'POST',
      headers,
      body,
    })
    const text = await res.text()
    let externalId: string | null = null
    try {
      const json = JSON.parse(text) as { externalId?: string; id?: string }
      externalId = json.externalId ?? json.id ?? null
    } catch {
      externalId = res.ok ? `http-${res.status}` : null
    }
    if (!res.ok) {
      return { externalId, ok: false, error: `Webhook HTTP ${res.status}` }
    }
    return { externalId, ok: true }
  } catch (error) {
    return {
      externalId: null,
      ok: false,
      error: error instanceof Error ? error.message : 'Webhook request failed',
    }
  }
}