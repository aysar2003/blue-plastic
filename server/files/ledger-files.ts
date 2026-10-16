import 'server-only'

import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

const ROOT = path.resolve(process.cwd(), 'uploads', 'ledger')
const MAX = 4 * 1024 * 1024

const ALLOWED = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

export type LedgerFileLink = {
  importedTransactionId?: string
  journalId?: string
  purchaseDocumentId?: string
  salesDocumentId?: string
}

export type LedgerFileRow = {
  id: string
  originalName: string
  contentType: string
  byteSize: number
  createdAt: Date
}

function sniff(bytes: Buffer): { contentType: string; extension: string } | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { contentType: 'application/pdf', extension: 'pdf' }
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: 'jpg' }
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { contentType: 'image/png', extension: 'png' }
  }
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return { contentType: 'image/webp', extension: 'webp' }
  }
  return null
}

async function resolveLink(ctx: OrgContext, link: LedgerFileLink): Promise<LedgerFileLink> {
  const keys = [
    link.importedTransactionId,
    link.journalId,
    link.purchaseDocumentId,
    link.salesDocumentId,
  ].filter(Boolean)
  if (keys.length !== 1) {
    throw validation('Attach the file to exactly one document.')
  }

  if (link.importedTransactionId) {
    const row = await db.importedTransaction.findFirst({
      where: { id: link.importedTransactionId, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!row) throw notFound('Statement line')
    return { importedTransactionId: row.id }
  }

  if (link.journalId) {
    const row = await db.journal.findFirst({
      where: { id: link.journalId, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!row) throw notFound('Journal')
    return { journalId: row.id }
  }

  if (link.purchaseDocumentId) {
    const row = await db.purchaseDocument.findFirst({
      where: { id: link.purchaseDocumentId, orgId: ctx.orgId, deletedAt: null },
      select: { id: true, journalId: true },
    })
    if (!row) throw notFound('Document')
    return {
      purchaseDocumentId: row.id,
      journalId: row.journalId ?? undefined,
    }
  }

  const row = await db.salesDocument.findFirst({
    where: { id: link.salesDocumentId!, orgId: ctx.orgId, deletedAt: null },
    select: { id: true, journalId: true },
  })
  if (!row) throw notFound('Document')
  return {
    salesDocumentId: row.id,
    journalId: row.journalId ?? undefined,
  }
}

/**
 * Store a PDF or image against a bank line, journal, sale, or purchase.
 * Bytes are sniffed — the client Content-Type is ignored.
 */
export async function storeLedgerFile(ctx: OrgContext, file: File, rawLink: LedgerFileLink) {
  if (file.size <= 0 || file.size > MAX) throw validation('Attach a PDF or image of 4 MB or smaller.')
  const bytes = Buffer.from(await file.arrayBuffer())
  const sniffed = sniff(bytes)
  if (!sniffed || !ALLOWED.has(sniffed.contentType)) {
    throw validation('Attach a PDF, JPEG, PNG, or WebP.')
  }

  const link = await resolveLink(ctx, rawLink)
  const storageKey = `${ctx.orgId}/${randomBytes(16).toString('hex')}.${sniffed.extension}`
  await mkdir(path.join(/*turbopackIgnore: true*/ ROOT, ctx.orgId), { recursive: true })
  await writeFile(path.join(/*turbopackIgnore: true*/ ROOT, storageKey), bytes)

  return db.ledgerFile.create({
    data: {
      orgId: ctx.orgId,
      originalName: file.name.slice(0, 180) || `attachment.${sniffed.extension}`,
      contentType: sniffed.contentType,
      byteSize: bytes.length,
      storageKey,
      importedTransactionId: link.importedTransactionId ?? null,
      journalId: link.journalId ?? null,
      purchaseDocumentId: link.purchaseDocumentId ?? null,
      salesDocumentId: link.salesDocumentId ?? null,
      createdById: ctx.userId,
    },
    select: { id: true, originalName: true, contentType: true, byteSize: true, createdAt: true },
  })
}

export async function readLedgerFile(ctx: OrgContext, id: string) {
  const file = await db.ledgerFile.findFirst({
    where: { id, orgId: ctx.orgId },
  })
  if (!file) throw notFound('File')
  const bytes = await readFile(absolutePath(file.storageKey))
  return { file, bytes }
}

export async function removeLedgerFile(ctx: OrgContext, id: string) {
  const file = await db.ledgerFile.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, storageKey: true },
  })
  if (!file) throw notFound('File')
  await db.ledgerFile.delete({ where: { id: file.id } })
  try {
    await unlink(absolutePath(file.storageKey))
  } catch {
    // Missing file on disk should not block the DB delete.
  }
  return { id: file.id }
}

/** Refuse path traversal even if a storage key in the DB is ever corrupted. */
function absolutePath(storageKey: string) {
  const full = path.resolve(/*turbopackIgnore: true*/ ROOT, storageKey)
  const relative = path.relative(/*turbopackIgnore: true*/ ROOT, full)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw validation('That file could not be read.')
  }
  return full
}

const LIST_SELECT = {
  id: true,
  originalName: true,
  contentType: true,
  byteSize: true,
  createdAt: true,
} as const

export async function listForPurchase(ctx: OrgContext, purchaseDocumentId: string): Promise<LedgerFileRow[]> {
  return db.ledgerFile.findMany({
    where: { orgId: ctx.orgId, purchaseDocumentId },
    select: LIST_SELECT,
    orderBy: { createdAt: 'asc' },
  })
}

export async function listForSale(ctx: OrgContext, salesDocumentId: string): Promise<LedgerFileRow[]> {
  return db.ledgerFile.findMany({
    where: { orgId: ctx.orgId, salesDocumentId },
    select: LIST_SELECT,
    orderBy: { createdAt: 'asc' },
  })
}

export async function listForJournal(ctx: OrgContext, journalId: string): Promise<LedgerFileRow[]> {
  return db.ledgerFile.findMany({
    where: { orgId: ctx.orgId, journalId, purchaseDocumentId: null, salesDocumentId: null },
    select: LIST_SELECT,
    orderBy: { createdAt: 'asc' },
  })
}
