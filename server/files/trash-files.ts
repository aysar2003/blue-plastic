import 'server-only'

import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

const ROOT = path.resolve(process.cwd(), 'uploads', 'trash')
const MAX = 4 * 1024 * 1024
const MAX_FILES = 12

const FILE_SELECT = {
  id: true,
  originalName: true,
  contentType: true,
  byteSize: true,
  createdAt: true,
} as const

export type TrashFileRow = {
  id: string
  originalName: string
  contentType: string
  byteSize: number
  createdAt: Date
}

function sniff(bytes: Buffer): { contentType: string; extension: string } | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') {
    return { contentType: 'application/pdf', extension: 'pdf' }
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: 'jpg' }
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { contentType: 'image/png', extension: 'png' }
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { contentType: 'image/webp', extension: 'webp' }
  }
  return null
}

async function assertTrashLog(ctx: OrgContext, auditLogId: string) {
  const log = await db.auditLog.findFirst({
    where: { id: auditLogId, orgId: ctx.orgId, action: 'DELETE' },
    select: { id: true },
  })
  if (!log) throw notFound('Trash entry')
  return log
}

export async function listTrashFiles(ctx: OrgContext, auditLogId: string): Promise<TrashFileRow[]> {
  await assertTrashLog(ctx, auditLogId)
  return db.trashFile.findMany({
    where: { orgId: ctx.orgId, auditLogId },
    select: FILE_SELECT,
    orderBy: { createdAt: 'asc' },
  })
}

export async function storeTrashFile(ctx: OrgContext, auditLogId: string, file: File) {
  const stored = await storeTrashFiles(ctx, auditLogId, [file])
  return stored[0]
}

/** One or many papers on any trash entry — invoice, bill, expense, payment, or other. */
export async function storeTrashFiles(ctx: OrgContext, auditLogId: string, files: File[]) {
  await assertTrashLog(ctx, auditLogId)
  const uploads = files.filter((file) => file instanceof File && file.size > 0 && file.name)
  if (uploads.length === 0) throw validation('Choose a PDF or image to attach.')

  const already = await db.trashFile.count({ where: { orgId: ctx.orgId, auditLogId } })
  if (already + uploads.length > MAX_FILES) {
    throw validation(`Keep at most ${MAX_FILES} papers on one trash entry.`)
  }

  const stored: { id: string; originalName: string }[] = []
  for (const file of uploads) {
    if (file.size > MAX) throw validation('Each file must be 4 MB or smaller.')
    const bytes = Buffer.from(await file.arrayBuffer())
    const sniffed = sniff(bytes)
    if (!sniffed) throw validation('Attach a PDF, JPEG, PNG, or WebP.')

    const storageKey = `${ctx.orgId}/${auditLogId}/${randomBytes(16).toString('hex')}.${sniffed.extension}`
    const destination = path.join(/*turbopackIgnore: true*/ ROOT, storageKey)
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, bytes)

    try {
      stored.push(
        await db.trashFile.create({
          data: {
            orgId: ctx.orgId,
            auditLogId,
            originalName: safeName(file.name),
            contentType: sniffed.contentType,
            byteSize: bytes.length,
            storageKey,
            createdById: ctx.userId,
          },
          select: { id: true, originalName: true },
        }),
      )
    } catch (error) {
      await unlink(destination).catch(() => undefined)
      throw error
    }
  }
  return stored
}

export async function readTrashFile(ctx: OrgContext, auditLogId: string, fileId: string) {
  const file = await db.trashFile.findFirst({
    where: { id: fileId, auditLogId, orgId: ctx.orgId },
  })
  if (!file) throw notFound('File')
  const bytes = await readFile(path.join(/*turbopackIgnore: true*/ ROOT, file.storageKey))
  return { file, bytes }
}

export async function removeTrashFile(ctx: OrgContext, auditLogId: string, fileId: string) {
  const file = await db.trashFile.findFirst({
    where: { id: fileId, auditLogId, orgId: ctx.orgId },
    select: { id: true, storageKey: true },
  })
  if (!file) throw notFound('File')
  await db.trashFile.delete({ where: { id: file.id } })
  await unlink(path.join(/*turbopackIgnore: true*/ ROOT, file.storageKey)).catch(() => undefined)
}

function safeName(name: string) {
  const base = path.basename(name).replace(/[\r\n"]/g, '').trim()
  return (base || 'file').slice(0, 180)
}
