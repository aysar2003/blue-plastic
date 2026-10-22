import 'server-only'

import type { CompanyAgreementStatus } from '@prisma/client'

import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forbidden, notFound, validation } from '@/server/errors'
import {
  assertAgreementOrg,
  readAgreementBytes,
  removeAgreementStored,
  storeAgreementFile,
} from '@/server/files/company-agreements'

function requireOwner(ctx: OrgContext) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can manage company agreements.')
  }
}

export async function listForCompany(ctx: OrgContext, orgId: string) {
  requireOwner(ctx)
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  })
  if (!org) throw notFound('Company')

  const rows = await db.companyAgreement.findMany({
    where: { orgId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    startsOn: row.startsOn?.toISOString().slice(0, 10) ?? null,
    endsOn: row.endsOn?.toISOString().slice(0, 10) ?? null,
    notes: row.notes,
    originalName: row.originalName,
    contentType: row.contentType,
    byteSize: row.byteSize,
    hasFile: Boolean(row.storageKey),
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function create(
  ctx: OrgContext,
  input: {
    orgId: string
    title: string
    status?: CompanyAgreementStatus
    startsOn?: string | null
    endsOn?: string | null
    notes?: string | null
    file?: File | null
  },
) {
  requireOwner(ctx)
  const title = input.title.trim()
  if (!title) throw validation('Give the agreement a title.', { title: ['Required.'] })

  const org = await db.organization.findUnique({
    where: { id: input.orgId },
    select: { id: true },
  })
  if (!org) throw notFound('Company')

  const row = await db.companyAgreement.create({
    data: {
      orgId: input.orgId,
      title,
      status: input.status ?? 'DRAFT',
      startsOn: input.startsOn ? new Date(input.startsOn) : null,
      endsOn: input.endsOn ? new Date(input.endsOn) : null,
      notes: input.notes?.trim() || null,
      createdById: ctx.userId,
    },
  })

  if (input.file && input.file.size > 0) {
    const stored = await storeAgreementFile(ctx, input.orgId, row.id, input.file)
    await db.companyAgreement.update({
      where: { id: row.id },
      data: stored,
    })
  }

  return { id: row.id }
}

export async function setStatus(
  ctx: OrgContext,
  input: { orgId: string; agreementId: string; status: CompanyAgreementStatus },
) {
  requireOwner(ctx)
  await assertAgreementOrg(input.orgId, input.agreementId)
  await db.companyAgreement.update({
    where: { id: input.agreementId },
    data: { status: input.status },
  })
  return { id: input.agreementId }
}

export async function remove(ctx: OrgContext, input: { orgId: string; agreementId: string }) {
  requireOwner(ctx)
  const row = await assertAgreementOrg(input.orgId, input.agreementId)
  await db.companyAgreement.delete({ where: { id: row.id } })
  await removeAgreementStored(row.storageKey)
  return { id: row.id }
}

export async function download(
  ctx: OrgContext,
  input: { orgId: string; agreementId: string },
) {
  requireOwner(ctx)
  const row = await assertAgreementOrg(input.orgId, input.agreementId)
  if (!row.storageKey || !row.contentType || !row.originalName) {
    throw notFound('File')
  }
  const bytes = await readAgreementBytes(row.storageKey)
  return {
    bytes,
    contentType: row.contentType,
    originalName: row.originalName,
  }
}

/** True when any agreement on the company is ENDED. */
export async function hasEndedAgreement(orgId: string) {
  const count = await db.companyAgreement.count({
    where: { orgId, status: 'ENDED' },
  })
  return count > 0
}
