import 'server-only'

import type { Prisma, SignRequestStatus, SignWebhookEventStatus } from '@prisma/client'

import {
  inboundEventType,
  mapInboundSignStatus,
  parseInboundSignWebhookPayload,
  parseSignProvider,
  verifySignWebhookSignature,
  type InboundSignMappedStatus,
} from '@/lib/erp/sign-provider'
import { db } from '@/server/db'
import { notFound, unauthenticated, validation } from '@/server/errors'

function applyDecision(
  current: SignRequestStatus,
  next: InboundSignMappedStatus,
): 'noop' | 'apply' | 'refuse' {
  if (current === next) return 'noop'
  if (current === 'CANCELLED') return 'refuse'
  if (next === 'SIGNED' && (current === 'DRAFT' || current === 'SENT')) return 'apply'
  if (next === 'DECLINED' && (current === 'DRAFT' || current === 'SENT')) return 'apply'
  return 'refuse'
}

async function applyMappedStatus(
  request: { id: string; status: SignRequestStatus },
  mapped: InboundSignMappedStatus,
  payload: { reason?: string; signatureData?: string; signerName?: string },
) {
  const decision = applyDecision(request.status, mapped)
  if (decision === 'refuse') {
    throw validation(`Cannot map inbound status onto a ${request.status.toLowerCase()} sign request.`)
  }
  if (decision === 'noop') {
    return { id: request.id, status: request.status, unchanged: true as const }
  }
  const now = new Date()
  const data =
    mapped === 'SIGNED'
      ? {
          status: 'SIGNED' as const,
          signedAt: now,
          signatureData: payload.signatureData || 'provider-signed',
          signerName: payload.signerName || undefined,
        }
      : {
          status: 'DECLINED' as const,
          declinedAt: now,
          declineReason: payload.reason || null,
        }
  const after = await db.signRequest.update({
    where: { id: request.id },
    data,
    select: { id: true, status: true },
  })
  return { ...after, unchanged: false as const }
}

export type IngestSignWebhookResult = {
  ok: boolean
  eventId: string
  applied: boolean
  status: SignWebhookEventStatus
  signRequestId?: string
  mapped?: InboundSignMappedStatus | null
  error?: string
}

export async function ingestInboundSignWebhook(input: {
  orgId: string
  rawBody: string
  signatureHeader: string | null
}): Promise<IngestSignWebhookResult> {
  const org = await db.organization.findUnique({
    where: { id: input.orgId },
    select: { id: true, signProvider: true },
  })
  if (!org) throw notFound('Organisation')

  const config = parseSignProvider(org.signProvider)
  const secret = config.webhookSecret
  if (!secret) {
    throw unauthenticated('This organisation has no sign webhook secret.')
  }

  let parsedJson: unknown = {}
  try {
    parsedJson = input.rawBody.trim() ? JSON.parse(input.rawBody) : {}
  } catch {
    throw validation('Webhook body must be JSON.')
  }

  const payload = parseInboundSignWebhookPayload(parsedJson)
  if (!payload) {
    throw validation('Webhook JSON needs a status (or event) field.')
  }

  const signatureOk = verifySignWebhookSignature(secret, input.rawBody, input.signatureHeader)
  const mapped = mapInboundSignStatus(payload.status)
  const eventType = inboundEventType(mapped)

  const event = await db.signWebhookEvent.create({
    data: {
      orgId: org.id,
      externalId: payload.externalId ?? null,
      eventType,
      payload: parsedJson as Prisma.InputJsonValue,
      signatureOk,
      status: signatureOk ? 'RECEIVED' : 'REJECTED',
      lastError: signatureOk ? null : 'Invalid HMAC signature.',
    },
    select: { id: true },
  })

  return processInboundEvent(event.id)
}

async function processInboundEvent(eventId: string): Promise<IngestSignWebhookResult> {
  const event = await db.signWebhookEvent.findUnique({
    where: { id: eventId },
  })
  if (!event) throw notFound('Sign webhook event')

  const payload = parseInboundSignWebhookPayload(event.payload)
  const mapped = payload ? mapInboundSignStatus(payload.status) : null

  if (!event.signatureOk) {
    await db.signWebhookEvent.update({
      where: { id: event.id },
      data: { status: 'REJECTED', lastError: 'Invalid HMAC signature.', processedAt: new Date() },
    })
    return {
      ok: false,
      eventId: event.id,
      applied: false,
      status: 'REJECTED',
      mapped,
      error: 'Invalid HMAC signature.',
    }
  }

  if (!payload || !mapped) {
    await db.signWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: 'REJECTED',
        lastError: 'Unmapped inbound status.',
        eventType: inboundEventType(null),
        processedAt: new Date(),
      },
    })
    return {
      ok: false,
      eventId: event.id,
      applied: false,
      status: 'REJECTED',
      mapped,
      error: 'Unmapped inbound status.',
    }
  }

  const request = payload.requestId
    ? await db.signRequest.findFirst({
        where: { orgId: event.orgId, id: payload.requestId },
        select: { id: true, status: true },
      })
    : payload.externalId
      ? await db.signRequest.findFirst({
          where: { orgId: event.orgId, externalId: payload.externalId },
          select: { id: true, status: true },
        })
      : null

  if (!request) {
    await db.signWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: 'FAILED',
        lastError: 'Sign request not found.',
        attempts: event.status === 'FAILED' ? event.attempts + 1 : event.attempts,
        eventType: inboundEventType(mapped),
      },
    })
    return {
      ok: false,
      eventId: event.id,
      applied: false,
      status: 'FAILED',
      mapped,
      error: 'Sign request not found.',
    }
  }

  try {
    const applied = await applyMappedStatus(request, mapped, {
      reason: payload.reason,
      signatureData: payload.signatureData,
      signerName: payload.signerName,
    })
    await db.signWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: 'APPLIED',
        signRequestId: request.id,
        eventType: inboundEventType(mapped),
        lastError: null,
        processedAt: new Date(),
        attempts: event.status === 'FAILED' ? event.attempts + 1 : event.attempts,
      },
    })
    return {
      ok: true,
      eventId: event.id,
      applied: !applied.unchanged,
      status: 'APPLIED',
      signRequestId: request.id,
      mapped,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Apply failed.'
    await db.signWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: 'FAILED',
        signRequestId: request.id,
        lastError: message,
        eventType: inboundEventType(mapped),
        attempts: event.status === 'FAILED' ? event.attempts + 1 : event.attempts,
      },
    })
    return {
      ok: false,
      eventId: event.id,
      applied: false,
      status: 'FAILED',
      signRequestId: request.id,
      mapped,
      error: message,
    }
  }
}

/** Re-run FAILED inbound events (same payload, same HMAC already verified). */
export async function retryFailedSignWebhookEvents(orgId?: string, limit = 20) {
  const rows = await db.signWebhookEvent.findMany({
    where: {
      status: 'FAILED',
      signatureOk: true,
      ...(orgId ? { orgId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  })
  const results: IngestSignWebhookResult[] = []
  for (const row of rows) {
    results.push(await processInboundEvent(row.id))
  }
  return results
}
