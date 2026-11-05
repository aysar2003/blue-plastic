import 'server-only'

import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  capabilityById,
  type CapabilityId,
} from '@/lib/erp/capabilities'
import { trialBalance } from '@/server/accounting/balances'
import { requireApiKeyContext } from '@/server/auth/api-key-context'
import { isAppError } from '@/server/errors'
import { serializeForApi } from '@/server/api/v1/serialize'
import * as bankFeed from '@/server/services/bank-feed.service'
import * as inventory from '@/server/services/inventory.service'
import * as payment from '@/server/services/payment.service'
import * as purchase from '@/server/services/purchase.service'

async function runCapability(id: CapabilityId, ctx: Awaited<ReturnType<typeof requireApiKeyContext>>, input: unknown) {
  const cap = capabilityById(id)
  if (!cap) throw new Error(`Unknown capability ${id}`)
  const parsed = cap.input.parse(input)

  switch (id) {
    case 'ar.listOpen':
      return bankFeed.openInvoices(ctx)
    case 'stock.onHand':
      return inventory.stockOnHand(ctx)
    case 'payment.create':
      return payment.create(ctx, parsed as Parameters<typeof payment.create>[1])
    case 'po.create':
      return purchase.create(ctx, 'PURCHASE_ORDER', parsed as Parameters<typeof purchase.create>[2])
    case 'report.trialBalance': {
      const range = parsed as { from: string; to: string }
      return trialBalance(ctx.orgId, range)
    }
    default: {
      const _exhaustive: never = id
      throw new Error(`Unhandled capability ${_exhaustive}`)
    }
  }
}

export async function invokeCapability(
  request: Request,
  capabilityId: string,
  rawInput: unknown,
): Promise<NextResponse> {
  try {
    const cap = capabilityById(capabilityId)
    if (!cap) {
      return NextResponse.json({ error: 'Unknown capability.' }, { status: 404 })
    }
    const ctx = await requireApiKeyContext(request, cap.permission)
    const data = await runCapability(cap.id as CapabilityId, ctx, rawInput)
    return NextResponse.json({ ok: true, capability: cap.id, data: serializeForApi(data) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details: Record<string, string[]> = {}
      for (const issue of error.issues) {
        const key = issue.path.join('.') || '_'
        ;(details[key] ??= []).push(issue.message)
      }
      return NextResponse.json(
        { error: 'Please correct the highlighted fields.', details },
        { status: 422 },
      )
    }
    if (isAppError(error)) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status },
      )
    }
    console.error(`[api/v1:${capabilityId}]`, error)
    return NextResponse.json({ error: 'Request failed.' }, { status: 500 })
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text()
  if (!text.trim()) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    return {}
  }
}

export function queryObject(request: Request): Record<string, string> {
  const out: Record<string, string> = {}
  const url = new URL(request.url)
  url.searchParams.forEach((value: string, key: string) => {
    out[key] = value
  })
  return out
}
