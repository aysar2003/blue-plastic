import 'server-only'

import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

export async function storeLedgerFile(
  ctx: OrgContext,
  file: File,
  link: { importedTransactionId?: string; journalId?: string; purchaseDocumentId?: string },
) {
  if (file.size <= 0 || file.size > MAX) throw validation('Attach a PDF or image of 4 MB or smaller.')
  const bytes = Buffer.from(await file.arrayBuffer())
  const sniffed = sniff(bytes)
  if (!sniffed || !ALLOWED.has(sniffed.contentType)) {
    throw validation('Attach a PDF, JPEG, PNG, or WebP.')
  }

  if (link.importedTransactionId) {
    const row = await db.importedTransaction.findFirst({
      where: { id: link.importedTransactionId, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!row) throw notFound('Statement line')
  }
  if (link.purchaseDocumentId) {
    const row = await db.purchaseDocument.findFirst({
      where: { id: link.purchaseDocumentId, orgId: ctx.orgId },
      select: { id: true, journalId: true },
    })
    if (!row) throw notFound('Document')
    link = { ...link, journalId: link.journalId ?? row.journalId ?? undefined }
  }

  const storageKey = `${ctx.orgId}/${randomBytes(16).toString('hex')}.${sniffed.extension}`
  await mkdir(path.join(/*turbopackIgnore: true*/ ROOT, ctx.orgId), { recursive: true })
  await writeFile(path.join(/*turbopackIgnore: true*/ ROOT, storageKey), bytes)

  return db.ledgerFile.create({
    data: {
      orgId: ctx.orgId,
      originalName: file.name.slice(0, 180) || `receipt.${sniffed.extension}`,
      contentType: sniffed.contentType,
      byteSize: bytes.length,
      storageKey,
      importedTransactionId: link.importedTransactionId ?? null,
      journalId: link.journalId ?? null,
      purchaseDocumentId: link.purchaseDocumentId ?? null,
      createdById: ctx.userId,
    },
    select: { id: true, originalName: true },
  })
}

export async function readLedgerFile(ctx: OrgContext, id: string) {
  const file = await db.ledgerFile.findFirst({
    where: { id, orgId: ctx.orgId },
  })
  if (!file) throw notFound('File')
  const bytes = await readFile(path.join(/*turbopackIgnore: true*/ ROOT, file.storageKey))
  return { file, bytes }
}

export async function listForPurchase(ctx: OrgContext, purchaseDocumentId: string) {
  return db.ledgerFile.findMany({
    where: { orgId: ctx.orgId, purchaseDocumentId },
    select: { id: true, originalName: true, contentType: true },
    orderBy: { createdAt: 'asc' },
  })
}
