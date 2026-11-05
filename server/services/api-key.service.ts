import 'server-only'

import { randomBytes } from 'node:crypto'

import { z } from 'zod'

import { displayPrefix, tokenLookup } from '@/lib/erp/api-key-token'
import { capabilityPermissionUniverse } from '@/lib/erp/capabilities'
import { isStaffPermission, type Permission } from '@/lib/permissions-catalog'
import { requiredText } from '@/lib/validation/common'
import { hashPassword, verifyPassword } from '@/server/auth/password'
import type { OrgContext } from '@/server/auth/context'
import { requestMeta, writeAudit } from '@/server/audit'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

const TOKEN_PREFIX = 'som_'

function newPlainToken() {
  return `${TOKEN_PREFIX}${randomBytes(24).toString('base64url')}`
}

export { displayPrefix, tokenLookup }

const createSchema = z.object({
  name: requiredText('Name', 80),
  scopes: z
    .array(z.string())
    .min(1, 'Choose at least one permission')
    .max(40)
    .transform((scopes, ctx) => {
      const allowed = new Set(capabilityPermissionUniverse())
      const cleaned: Permission[] = []
      for (const raw of scopes) {
        if (!isStaffPermission(raw) || !allowed.has(raw)) {
          ctx.addIssue({
            code: 'custom',
            message: `Unknown or disallowed scope: ${raw}`,
            path: ['scopes'],
          })
          return z.NEVER
        }
        cleaned.push(raw)
      }
      return [...new Set(cleaned)]
    }),
})

export type ApiKeyCreateInput = z.infer<typeof createSchema>

export function parseApiKeyCreate(input: unknown): ApiKeyCreateInput {
  return createSchema.parse(input)
}

export async function listKeys(ctx: OrgContext) {
  const rows = await db.apiKey.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ revokedAt: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  })
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
  }))
}

export async function createKey(ctx: OrgContext, input: ApiKeyCreateInput) {
  const plain = newPlainToken()
  const meta = await requestMeta()
  const row = await db.$transaction(async (tx) => {
    const created = await tx.apiKey.create({
      data: {
        orgId: ctx.orgId,
        name: input.name,
        prefix: displayPrefix(plain),
        tokenLookup: tokenLookup(plain),
        tokenHash: await hashPassword(plain),
        scopes: input.scopes,
        createdById: ctx.userId,
      },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ApiKey',
        entityId: created.id,
        action: 'CREATE',
        after: { name: created.name, scopes: created.scopes, prefix: created.prefix },
      },
      meta,
    )
    return created
  })
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    /** Shown once — store in the integration secret store. */
    token: plain,
  }
}

export async function revokeKey(ctx: OrgContext, id: string) {
  const existing = await db.apiKey.findFirst({
    where: { id, orgId: ctx.orgId, revokedAt: null },
  })
  if (!existing) throw notFound('API key')
  const meta = await requestMeta()
  await db.$transaction(async (tx) => {
    await tx.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ApiKey',
        entityId: id,
        action: 'UPDATE',
        before: { name: existing.name, scopes: existing.scopes },
        after: { revoked: true },
      },
      meta,
    )
  })
  return { id }
}

/**
 * Resolve a bearer token to the ApiKey row after bcrypt verify.
 */
export async function authenticateApiKey(plainToken: string) {
  const lookup = tokenLookup(plainToken)
  const row = await db.apiKey.findUnique({
    where: { tokenLookup: lookup },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          legalName: true,
          baseCurrency: true,
          fiscalYearStartMonth: true,
          timeZone: true,
          allowNegativeStock: true,
          posTillLedgerMode: true,
          featureFlags: true,
          parentOrgId: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          region: true,
          postalCode: true,
          country: true,
          phone: true,
          email: true,
          website: true,
          brandMark: true,
          logoStorageKey: true,
          updatedAt: true,
        },
      },
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  })
  if (!row || row.revokedAt) return null
  const ok = await verifyPassword(plainToken, row.tokenHash)
  if (!ok) return null

  await db.apiKey.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  })

  return row
}

export function assertScopeSubset(scopes: readonly string[], required: Permission) {
  if (!scopes.includes(required)) {
    throw validation(`This API key is missing the "${required}" scope.`, {
      scopes: [`Add ${required} when creating the key`],
    })
  }
}
