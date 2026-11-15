import 'server-only'

import { canCloseCapa, isCapaStatus, nextCapaStatus, type CapaStatus } from '@/lib/erp/capa'
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
      updatedAt: true,
    },
  })
}

export async function get(ctx: OrgContext, id: string) {
  const row = await db.capaNote.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
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

    const note = await tx.capaNote.create({
      data: {
        orgId: ctx.orgId,
        number,
        title: input.title.trim(),
        body: input.body?.trim() || null,
        status: 'OPEN',
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
  options?: { closeNote?: string | null },
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
    await tx.capaNote.update({
      where: { id: note.id },
      data: {
        status,
        ...(bodyPatch !== undefined ? { body: bodyPatch } : {}),
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