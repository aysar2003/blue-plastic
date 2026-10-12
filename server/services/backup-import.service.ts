import 'server-only'

import { createHash } from 'crypto'

import {
  companiesFromParsed,
  type CompanyBackup,
} from '@/lib/backup-format'
import { companyGroupKind, type CompanyGroupKind } from '@/lib/company-group'
import { companyLimitStatus } from '@/lib/company-limits'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forbidden, validation } from '@/server/errors'
import {
  createRemapIdMaps,
  insertBackupRows,
  newId,
} from '@/server/services/backup-restore.service'

export type DatabaseRow = {
  id: string
  name: string
  legalName: string | null
  baseCurrency: string
  role: string
  /** Active OWNER membership display name, when one exists. */
  ownerName: string | null
  isCurrent: boolean
  /** ISO timestamp — when the company books were last written. */
  updatedAt: string
  /**
   * Approximate on-disk size of this company's books (bytes), for the
   * QuickBooks-style File size column. Not a real `.qbw` file — shared Postgres.
   */
  sizeBytes: number
  parentOrgId: string | null
  parentName: string | null
  childCount: number
  groupKind: CompanyGroupKind
  accessRestricted: boolean
  rentExpiresAt: string | null
  maxUsers: number | null
  rentNote: string | null
  rentExpired: boolean
  openBlocked: boolean
  activeUsers: number
}

/** Empty-company overhead + average bytes per row for the heavy tables. */
const SIZE_BASE_BYTES = 48_000
const SIZE_WEIGHTS = {
  journal: 220,
  journalLine: 140,
  salesDocument: 280,
  salesDocumentLine: 160,
  purchaseDocument: 280,
  customer: 240,
  vendor: 220,
  item: 200,
  auditLog: 180,
  inventoryTransaction: 120,
} as const

/** Rough company size from row counts — enough for a QB-style File size column. */
async function estimateCompanyBytes(orgIds: string[]): Promise<Map<string, number>> {
  const sizes = new Map<string, number>(orgIds.map((id) => [id, SIZE_BASE_BYTES]))
  if (orgIds.length === 0) return sizes

  const where = { orgId: { in: orgIds } }
  const [
    journals,
    journalLines,
    salesDocuments,
    salesDocumentLines,
    purchaseDocuments,
    customers,
    vendors,
    items,
    auditLogs,
    inventoryTransactions,
  ] = await Promise.all([
    db.journal.groupBy({ by: ['orgId'], where, _count: { _all: true } }),
    db.journalLine.groupBy({ by: ['orgId'], where, _count: { _all: true } }),
    db.salesDocument.groupBy({ by: ['orgId'], where, _count: { _all: true } }),
    db.salesDocumentLine.groupBy({ by: ['orgId'], where, _count: { _all: true } }),
    db.purchaseDocument.groupBy({ by: ['orgId'], where, _count: { _all: true } }),
    db.customer.groupBy({ by: ['orgId'], where, _count: { _all: true } }),
    db.vendor.groupBy({ by: ['orgId'], where, _count: { _all: true } }),
    db.item.groupBy({ by: ['orgId'], where, _count: { _all: true } }),
    db.auditLog.groupBy({ by: ['orgId'], where, _count: { _all: true } }),
    db.inventoryTransaction.groupBy({ by: ['orgId'], where, _count: { _all: true } }),
  ])

  const add = (
    rows: { orgId: string; _count: { _all: number } }[],
    weight: number,
  ) => {
    for (const row of rows) {
      sizes.set(row.orgId, (sizes.get(row.orgId) ?? SIZE_BASE_BYTES) + row._count._all * weight)
    }
  }

  add(journals, SIZE_WEIGHTS.journal)
  add(journalLines, SIZE_WEIGHTS.journalLine)
  add(salesDocuments, SIZE_WEIGHTS.salesDocument)
  add(salesDocumentLines, SIZE_WEIGHTS.salesDocumentLine)
  add(purchaseDocuments, SIZE_WEIGHTS.purchaseDocument)
  add(customers, SIZE_WEIGHTS.customer)
  add(vendors, SIZE_WEIGHTS.vendor)
  add(items, SIZE_WEIGHTS.item)
  add(auditLogs, SIZE_WEIGHTS.auditLog)
  add(inventoryTransactions, SIZE_WEIGHTS.inventoryTransaction)

  return sizes
}

export type InspectedCompany = {
  key: string
  sourceLabel: string
  organizationId: string
  name: string
  legalName: string | null
  baseCurrency: string
  takenAt: string | null
  status: 'present' | 'missing'
  matchedOrgId: string | null
  matchedName: string | null
}

function toDatabaseRow(
  organization: {
    id: string
    name: string
    legalName: string | null
    baseCurrency: string
    updatedAt: Date
    parentOrgId: string | null
    parent: { name: string } | null
    _count: { children: number; memberships: number }
    accessRestricted: boolean
    rentExpiresAt: Date | null
    maxUsers: number | null
    rentNote: string | null
  },
  role: string,
  currentOrgId: string,
  sizeBytes: number,
  ownerName: string | null,
): DatabaseRow {
  const childCount = organization._count.children
  const limits = companyLimitStatus(organization)
  return {
    id: organization.id,
    name: organization.name,
    legalName: organization.legalName,
    baseCurrency: organization.baseCurrency,
    role,
    ownerName,
    isCurrent: organization.id === currentOrgId,
    updatedAt: organization.updatedAt.toISOString(),
    sizeBytes,
    parentOrgId: organization.parentOrgId,
    parentName: organization.parent?.name ?? null,
    childCount,
    groupKind: companyGroupKind({
      parentOrgId: organization.parentOrgId,
      childCount,
    }),
    accessRestricted: limits.accessRestricted,
    rentExpiresAt: limits.rentExpiresAt,
    maxUsers: limits.maxUsers,
    rentNote: limits.rentNote,
    rentExpired: limits.rentExpired,
    openBlocked: limits.openBlocked,
    activeUsers: organization._count.memberships,
  }
}

/** First active OWNER name per company (for the databases home meta line). */
async function ownerNamesByOrg(orgIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (orgIds.length === 0) return names
  const owners = await db.membership.findMany({
    where: { orgId: { in: orgIds }, role: 'OWNER', status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: {
      orgId: true,
      user: { select: { name: true } },
    },
  })
  for (const row of owners) {
    if (!names.has(row.orgId) && row.user.name.trim()) {
      names.set(row.orgId, row.user.name.trim())
    }
  }
  return names
}

const ORG_LIST_SELECT = {
  id: true,
  name: true,
  legalName: true,
  baseCurrency: true,
  updatedAt: true,
  parentOrgId: true,
  parent: { select: { name: true } },
  accessRestricted: true,
  rentExpiresAt: true,
  maxUsers: true,
  rentNote: true,
  _count: {
    select: {
      children: true,
      memberships: { where: { status: 'ACTIVE' as const } },
    },
  },
} as const

/** Companies this person is allowed to see. Staff see only the one they are in. */
export async function listUserDatabases(ctx: OrgContext): Promise<DatabaseRow[]> {
  if (ctx.isSystemOwner) {
    const [organizations, memberships] = await Promise.all([
      db.organization.findMany({
        orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
        select: ORG_LIST_SELECT,
      }),
      db.membership.findMany({
        where: { userId: ctx.userId, status: 'ACTIVE' },
        select: { orgId: true, role: true },
      }),
    ])
    const orgIds = organizations.map((row) => row.id)
    const roleByOrg = new Map(memberships.map((row) => [row.orgId, row.role]))
    const [sizeByOrg, ownerByOrg] = await Promise.all([
      estimateCompanyBytes(orgIds),
      ownerNamesByOrg(orgIds),
    ])
    return organizations.map((organization) =>
      toDatabaseRow(
        organization,
        roleByOrg.get(organization.id) ?? 'OWNER',
        ctx.orgId,
        sizeByOrg.get(organization.id) ?? SIZE_BASE_BYTES,
        ownerByOrg.get(organization.id) ?? null,
      ),
    )
  }

  const rows = await db.membership.findMany({
    where: {
      userId: ctx.userId,
      status: 'ACTIVE',
      ...(ctx.canConnect ? {} : { orgId: ctx.orgId }),
    },
    orderBy: { organization: { updatedAt: 'desc' } },
    select: {
      role: true,
      organization: { select: ORG_LIST_SELECT },
    },
  })

  const orgIds = rows.map((row) => row.organization.id)
  const [sizeByOrg, ownerByOrg] = await Promise.all([
    estimateCompanyBytes(orgIds),
    ownerNamesByOrg(orgIds),
  ])
  return rows.map((row) =>
    toDatabaseRow(
      row.organization,
      row.role,
      ctx.orgId,
      sizeByOrg.get(row.organization.id) ?? SIZE_BASE_BYTES,
      ownerByOrg.get(row.organization.id) ?? null,
    ),
  )
}

/**
 * Read one or more backup JSON strings and mark each company present / missing
 * against organisations already on this instance.
 */
export async function inspectBackupFiles(
  files: { name: string; text: string }[],
): Promise<InspectedCompany[]> {
  if (files.length === 0) throw validation('Choose at least one backup file.')

  const found = []
  for (const file of files) {
    let parsed: unknown
    try {
      parsed = JSON.parse(file.text)
    } catch {
      throw validation(`Could not read ${file.name} as JSON.`)
    }
    const companies = companiesFromParsed(parsed, file.name)
    if (companies.length === 0) {
      throw validation(`${file.name} is not a SOM ERP backup.`)
    }
    found.push(...companies)
  }

  const byOrg = new Map(found.map((company) => [company.organizationId, company]))
  const unique = [...byOrg.values()]

  const existing = await db.organization.findMany({
    where: {
      OR: [
        { id: { in: unique.map((c) => c.organizationId) } },
        { name: { in: unique.map((c) => c.name), mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  })

  const byId = new Map(existing.map((o) => [o.id, o]))
  const byName = new Map(existing.map((o) => [o.name.trim().toLowerCase(), o]))

  return unique.map((company) => {
    const match =
      byId.get(company.organizationId) ?? byName.get(company.name.trim().toLowerCase()) ?? null
    return {
      key: company.key,
      sourceLabel: company.sourceLabel,
      organizationId: company.organizationId,
      name: company.name,
      legalName: company.legalName,
      baseCurrency: company.baseCurrency,
      takenAt: company.takenAt,
      status: match ? ('present' as const) : ('missing' as const),
      matchedOrgId: match?.id ?? null,
      matchedName: match?.name ?? null,
    }
  })
}

export function payloadsFromFiles(files: { name: string; text: string }[]): Map<string, CompanyBackup> {
  const map = new Map<string, CompanyBackup>()
  for (const file of files) {
    const parsed = JSON.parse(file.text) as unknown
    for (const company of companiesFromParsed(parsed, file.name)) {
      map.set(company.key, company.payload)
    }
  }
  return map
}

export async function importMissingCompanies(
  ctx: OrgContext,
  files: { name: string; text: string }[],
  keys: string[],
): Promise<{ imported: { key: string; orgId: string; name: string }[]; skipped: string[] }> {
  if (!ctx.isSystemOwner) throw forbidden('Only the system owner can import a company.')
  if (!ctx.permissions.has('org:update')) throw forbidden('Only an owner can import a backup.')
  if (keys.length === 0) throw validation('Choose at least one database to import.')

  const payloads = payloadsFromFiles(files)
  const inspected = await inspectBackupFiles(files)
  const want = new Set(keys)

  const imported: { key: string; orgId: string; name: string }[] = []
  const skipped: string[] = []

  for (const row of inspected) {
    if (!want.has(row.key)) continue
    if (row.status === 'present') {
      skipped.push(row.key)
      continue
    }
    const payload = payloads.get(row.key)
    if (!payload) {
      skipped.push(row.key)
      continue
    }
    const orgId = await restoreCompanyAsNew(payload, ctx.userId)
    imported.push({ key: row.key, orgId, name: row.name })
  }

  return { imported, skipped }
}

/**
 * Create a new organisation from a company backup and load the full books
 * (master data + journals, documents, payments, stock movements).
 */
async function restoreCompanyAsNew(backup: CompanyBackup, actorUserId: string): Promise<string> {
  const org = backup.organization
  if (!org || typeof org.name !== 'string') throw validation('Backup has no organisation.')

  const newOrgId = newId()
  const ids = createRemapIdMaps(String(org.id), newOrgId)

  let name = String(org.name)
  const nameTaken = await db.organization.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  })
  if (nameTaken) name = `${name} (imported)`

  await db.$transaction(
    async (tx) => {
      await tx.organization.create({
        data: {
          id: newOrgId,
          name,
          legalName: (org.legalName as string | null) ?? null,
          baseCurrency: typeof org.baseCurrency === 'string' ? org.baseCurrency : 'USD',
          fiscalYearStartMonth:
            typeof org.fiscalYearStartMonth === 'number' ? org.fiscalYearStartMonth : 1,
          taxRegistrationNumber: (org.taxRegistrationNumber as string | null) ?? null,
          addressLine1: (org.addressLine1 as string | null) ?? null,
          addressLine2: (org.addressLine2 as string | null) ?? null,
          city: (org.city as string | null) ?? null,
          region: (org.region as string | null) ?? null,
          postalCode: (org.postalCode as string | null) ?? null,
          country: (org.country as string | null) ?? null,
          phone: (org.phone as string | null) ?? null,
          email: (org.email as string | null) ?? null,
          website: (org.website as string | null) ?? null,
          timeZone: typeof org.timeZone === 'string' ? org.timeZone : 'UTC',
          allowNegativeStock: org.allowNegativeStock !== false,
          featureFlags: (org.featureFlags as object | null) ?? undefined,
          documentTemplate: (org.documentTemplate as object | null) ?? undefined,
        },
      })

      await tx.membership.create({
        data: {
          orgId: newOrgId,
          userId: actorUserId,
          role: 'OWNER',
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      })

      await insertBackupRows(tx, newOrgId, backup, ids)

      await tx.auditLog.create({
        data: {
          orgId: newOrgId,
          actorId: actorUserId,
          entity: 'Organization',
          entityId: newOrgId,
          action: 'CREATE',
          after: {
            importedFromBackup: true,
            originalOrgId: org.id,
            fingerprint: createHash('sha256').update(String(org.id)).digest('hex').slice(0, 12),
          },
        },
      })
    },
    { maxWait: 20_000, timeout: 300_000 },
  )

  return newOrgId
}
