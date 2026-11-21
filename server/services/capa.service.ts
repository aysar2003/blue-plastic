import 'server-only'

import {
  canCloseCapa,
  capaExportBucket,
  isCapaStatus,
  nextCapaStatus,
  type CapaStatus,
} from '@/lib/erp/capa'
import { today, toCalendarDate } from '@/lib/date'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import { assignDocumentNumber, numberTaken } from '@/server/sequences'

export async function list(ctx: OrgContext, filter?: { status?: CapaStatus }) {
  return db.capaNote.findMany({
    where: {
      orgId: ctx.orgId,
      ...(filter?.status ? { status: filter.status } : {}),
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      dueDate: true,
      ownerId: true,
      owner: { select: { id: true, name: true } },
      vendor: { select: { id: true, displayName: true } },
      lotNumber: true,
      updatedAt: true,
    },
  })
}

export async function get(ctx: OrgContext, id: string) {
  const row = await db.capaNote.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      vendor: { select: { id: true, displayName: true } },
      workspaceDocument: { select: { id: true, title: true } },
      signRequest: { select: { id: true, title: true, status: true } },
    },
  })
  if (!row) throw notFound('CAPA note')
  return row
}

export async function create(
  ctx: OrgContext,
  input: {
    number?: string
    title: string
    body?: string | null
    ownerId?: string | null
    dueDate?: string | null
    rootCause?: string | null
    effectivenessDate?: string | null
    vendorId?: string | null
    lotNumber?: string | null
    workspaceDocumentId?: string | null
    signRequestId?: string | null
  },
) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const number = await assignDocumentNumber(tx, ctx.orgId, 'CAPA_NOTE', input.number)
    const clash = await tx.capaNote.findFirst({
      where: { orgId: ctx.orgId, number },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    if (input.workspaceDocumentId) {
      const doc = await tx.workspaceDocument.findFirst({
        where: { id: input.workspaceDocumentId, orgId: ctx.orgId },
        select: { id: true },
      })
      if (!doc) throw notFound('Document')
    }
    if (input.signRequestId) {
      const sign = await tx.signRequest.findFirst({
        where: { id: input.signRequestId, orgId: ctx.orgId },
        select: { id: true },
      })
      if (!sign) throw notFound('Sign request')
    }
    if (input.ownerId) {
      const owner = await tx.membership.findFirst({
        where: { orgId: ctx.orgId, userId: input.ownerId },
        select: { userId: true },
      })
      if (!owner) throw notFound('Owner')
    }
    if (input.vendorId) {
      const vendor = await tx.vendor.findFirst({
        where: { id: input.vendorId, orgId: ctx.orgId },
        select: { id: true },
      })
      if (!vendor) throw notFound('Vendor')
    }

    const note = await tx.capaNote.create({
      data: {
        orgId: ctx.orgId,
        number,
        title: input.title.trim(),
        body: input.body?.trim() || null,
        status: 'OPEN',
        ownerId: input.ownerId || null,
        dueDate: input.dueDate?.trim() ? new Date(`${input.dueDate.trim()}T00:00:00.000Z`) : null,
        rootCause: input.rootCause?.trim() || null,
        effectivenessDate: input.effectivenessDate?.trim()
          ? new Date(`${input.effectivenessDate.trim()}T00:00:00.000Z`)
          : null,
        vendorId: input.vendorId || null,
        lotNumber: input.lotNumber?.trim() || null,
        workspaceDocumentId: input.workspaceDocumentId ?? null,
        signRequestId: input.signRequestId ?? null,
        createdById: ctx.userId,
      },
      select: { id: true, number: true },
    })

    await writeAudit(
      tx,
      ctx,
      { entity: 'CapaNote', entityId: note.id, action: 'CREATE', after: { number: note.number } },
      meta,
    )
    return note
  })
}

export async function setStatus(
  ctx: OrgContext,
  id: string,
  status: string,
  options?: { closeNote?: string | null; effectivenessDate?: string | null },
) {
  if (!isCapaStatus(status)) throw validation('Invalid CAPA status.')
  const closeNote = options?.closeNote?.trim() ?? ''
  if (status === 'CLOSED' && !closeNote) {
    throw validation('Add a closing note before closing this CAPA.')
  }
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const note = await tx.capaNote.findFirst({
      where: { id, orgId: ctx.orgId },
      select: { id: true, number: true, status: true, body: true },
    })
    if (!note) throw notFound('CAPA note')
    const step = nextCapaStatus(note.status as CapaStatus, status)
    if (!step.ok) throw precondition(step.message)
    if (status === 'CLOSED' && !canCloseCapa(note.status as CapaStatus)) {
      throw precondition('This CAPA cannot be closed.')
    }
    const bodyPatch =
      status === 'CLOSED'
        ? [note.body, `--- Closed ---\n${closeNote}`].filter(Boolean).join('\n\n')
        : undefined
    const effectiveness =
      status === 'CLOSED' && options?.effectivenessDate?.trim()
        ? new Date(`${options.effectivenessDate.trim()}T00:00:00.000Z`)
        : status === 'CLOSED'
          ? new Date()
          : undefined
    await tx.capaNote.update({
      where: { id: note.id },
      data: {
        status,
        ...(bodyPatch !== undefined ? { body: bodyPatch } : {}),
        ...(effectiveness ? { effectivenessDate: effectiveness } : {}),
      },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'CapaNote',
        entityId: note.id,
        action: 'UPDATE',
        before: { status: note.status },
        after: { status },
      },
      meta,
    )
    return { id: note.id, number: note.number, status }
  })
}

export async function update(
  ctx: OrgContext,
  id: string,
  input: {
    title?: string
    body?: string | null
    ownerId?: string | null
    dueDate?: string | null
    rootCause?: string | null
    effectivenessDate?: string | null
    vendorId?: string | null
    lotNumber?: string | null
  },
) {
  const note = await db.capaNote.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!note) throw notFound('CAPA note')
  if (input.ownerId) {
    const owner = await db.membership.findFirst({
      where: { orgId: ctx.orgId, userId: input.ownerId },
      select: { userId: true },
    })
    if (!owner) throw notFound('Owner')
  }
  if (input.vendorId) {
    const vendor = await db.vendor.findFirst({
      where: { id: input.vendorId, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!vendor) throw notFound('Vendor')
  }
  return db.capaNote.update({
    where: { id: note.id },
    data: {
      ...(input.title != null ? { title: input.title.trim() } : {}),
      ...(input.body !== undefined ? { body: input.body?.trim() || null } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId || null } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate?.trim() ? new Date(`${input.dueDate.trim()}T00:00:00.000Z`) : null }
        : {}),
      ...(input.rootCause !== undefined ? { rootCause: input.rootCause?.trim() || null } : {}),
      ...(input.effectivenessDate !== undefined
        ? {
            effectivenessDate: input.effectivenessDate?.trim()
              ? new Date(`${input.effectivenessDate.trim()}T00:00:00.000Z`)
              : null,
          }
        : {}),
      ...(input.vendorId !== undefined ? { vendorId: input.vendorId || null } : {}),
      ...(input.lotNumber !== undefined ? { lotNumber: input.lotNumber?.trim() || null } : {}),
    },
    select: { id: true },
  })
}

export async function exportRows(ctx: OrgContext) {
  const asOf = today(ctx.organization.timeZone)
  const rows = await db.capaNote.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    take: 500,
    select: {
      number: true,
      title: true,
      status: true,
      dueDate: true,
      rootCause: true,
      effectivenessDate: true,
      lotNumber: true,
      owner: { select: { name: true } },
      vendor: { select: { displayName: true } },
    },
  })
  return rows.map((row) => {
    const due = row.dueDate ? toCalendarDate(row.dueDate) : null
    const status = row.status as CapaStatus
    return {
      number: row.number,
      title: row.title,
      status: row.status,
      bucket: capaExportBucket({ status, dueDate: due, asOf }),
      ownerName: row.owner?.name ?? null,
      dueDate: due,
      rootCause: row.rootCause,
      effectivenessDate: row.effectivenessDate ? toCalendarDate(row.effectivenessDate) : null,
      vendorName: row.vendor?.displayName ?? null,
      lotNumber: row.lotNumber,
    }
  })
}