import 'server-only'

import { randomBytes } from 'node:crypto'

import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, validation } from '@/server/errors'
import {
  createPresignedPutUrl,
  deleteStoredObject,
  getStoredObject,
  getStoredObjectRange,
  headStoredObject,
  putStoredObject,
  streamStoredObject,
} from '@/server/files/object-store'

const PREFIX = 'documents'
/** Large PDFs/scans — uploaded client→R2, not through the serverless request body. */
export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024
const MAX_FILES = 500
const MAX_FOLDERS = 40

const ALLOWED = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

const DEFAULT_FOLDERS: { systemKey: string; name: string; sequence: number }[] = [
  { systemKey: 'contracts', name: 'Contracts', sequence: 10 },
  { systemKey: 'finance', name: 'Finance', sequence: 20 },
  { systemKey: 'hr', name: 'HR', sequence: 30 },
  { systemKey: 'scans', name: 'Scans', sequence: 40 },
  { systemKey: 'general', name: 'General', sequence: 50 },
]

export type WorkspaceDocumentFolderRow = {
  id: string
  name: string
  systemKey: string | null
  isSystem: boolean
  sequence: number
  documentCount: number
}

export type WorkspaceDocumentRow = {
  id: string
  folderId: string | null
  title: string
  originalName: string
  contentType: string
  byteSize: number
  notes: string | null
  createdAt: Date
  updatedAt: Date
  createdByName: string | null
}

const SELECT = {
  id: true,
  folderId: true,
  title: true,
  originalName: true,
  contentType: true,
  byteSize: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { name: true } },
} as const

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
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { contentType: 'image/webp', extension: 'webp' }
  }
  return null
}

function objectKey(storageKey: string) {
  return `${PREFIX}/${storageKey}`
}

function mapRow(row: {
  id: string
  folderId: string | null
  title: string
  originalName: string
  contentType: string
  byteSize: number
  notes: string | null
  createdAt: Date
  updatedAt: Date
  createdBy: { name: string } | null
}): WorkspaceDocumentRow {
  return {
    id: row.id,
    folderId: row.folderId,
    title: row.title,
    originalName: row.originalName,
    contentType: row.contentType,
    byteSize: row.byteSize,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByName: row.createdBy?.name ?? null,
  }
}

function typeFromFileName(fileName: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return null
}

function normalizeDeclaredType(raw: string | null | undefined, fileName?: string): string | null {
  const base = (raw ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  if (base === 'image/jpg') return 'image/jpeg'
  if (base && ALLOWED.has(base)) return base
  if (fileName) return typeFromFileName(fileName)
  return null
}

export async function ensureDefaultFolders(ctx: OrgContext): Promise<void> {
  const existing = await db.workspaceDocumentFolder.findMany({
    where: { orgId: ctx.orgId, systemKey: { not: null } },
    select: { systemKey: true },
  })
  const have = new Set(existing.map((row) => row.systemKey).filter(Boolean))
  const missing = DEFAULT_FOLDERS.filter((folder) => !have.has(folder.systemKey))
  if (missing.length === 0) return

  await db.workspaceDocumentFolder.createMany({
    data: missing.map((folder) => ({
      orgId: ctx.orgId,
      name: folder.name,
      systemKey: folder.systemKey,
      isSystem: true,
      sequence: folder.sequence,
    })),
    skipDuplicates: true,
  })
}

export async function listFolders(ctx: OrgContext): Promise<WorkspaceDocumentFolderRow[]> {
  await ensureDefaultFolders(ctx)
  const rows = await db.workspaceDocumentFolder.findMany({
    where: { orgId: ctx.orgId },
    select: {
      id: true,
      name: true,
      systemKey: true,
      isSystem: true,
      sequence: true,
      _count: { select: { documents: true } },
    },
    orderBy: [{ sequence: 'asc' }, { name: 'asc' }],
  })
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    systemKey: row.systemKey,
    isSystem: row.isSystem,
    sequence: row.sequence,
    documentCount: row._count.documents,
  }))
}

export async function createFolder(ctx: OrgContext, name: string) {
  const trimmed = name.trim().slice(0, 80)
  if (!trimmed) throw validation('Enter a folder name.', { name: ['Required'] })

  const count = await db.workspaceDocumentFolder.count({ where: { orgId: ctx.orgId } })
  if (count >= MAX_FOLDERS) {
    throw validation(`This company already has ${MAX_FOLDERS} folders.`)
  }

  const maxSeq = await db.workspaceDocumentFolder.aggregate({
    where: { orgId: ctx.orgId },
    _max: { sequence: true },
  })

  try {
    const row = await db.workspaceDocumentFolder.create({
      data: {
        orgId: ctx.orgId,
        name: trimmed,
        isSystem: false,
        sequence: (maxSeq._max.sequence ?? 100) + 10,
      },
      select: { id: true, name: true, systemKey: true, isSystem: true, sequence: true },
    })
    return { ...row, documentCount: 0 }
  } catch {
    throw conflict('A folder with that name already exists.', {
      name: ['That name is already used'],
    })
  }
}

export async function renameFolder(ctx: OrgContext, id: string, name: string) {
  const trimmed = name.trim().slice(0, 80)
  if (!trimmed) throw validation('Enter a folder name.', { name: ['Required'] })

  const existing = await db.workspaceDocumentFolder.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, isSystem: true },
  })
  if (!existing) throw notFound('Folder')

  try {
    const row = await db.workspaceDocumentFolder.update({
      where: { id },
      data: { name: trimmed },
      select: {
        id: true,
        name: true,
        systemKey: true,
        isSystem: true,
        sequence: true,
        _count: { select: { documents: true } },
      },
    })
    return {
      id: row.id,
      name: row.name,
      systemKey: row.systemKey,
      isSystem: row.isSystem,
      sequence: row.sequence,
      documentCount: row._count.documents,
    }
  } catch {
    throw conflict('A folder with that name already exists.', {
      name: ['That name is already used'],
    })
  }
}

export async function removeFolder(ctx: OrgContext, id: string) {
  const existing = await db.workspaceDocumentFolder.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, isSystem: true },
  })
  if (!existing) throw notFound('Folder')
  if (existing.isSystem) {
    throw validation('Built-in folders cannot be deleted.')
  }

  await db.$transaction([
    db.workspaceDocument.updateMany({
      where: { orgId: ctx.orgId, folderId: id },
      data: { folderId: null },
    }),
    db.workspaceDocumentFolder.delete({ where: { id } }),
  ])
  return { id }
}

async function assertFolderInOrg(ctx: OrgContext, folderId: string | null | undefined) {
  if (!folderId) return null
  const folder = await db.workspaceDocumentFolder.findFirst({
    where: { id: folderId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!folder) throw validation('Choose a folder that belongs to this company.', { folderId: ['Invalid folder'] })
  return folder.id
}

export async function listDocuments(
  ctx: OrgContext,
  opts?: { q?: string; folderId?: string | null },
): Promise<WorkspaceDocumentRow[]> {
  const query = opts?.q?.trim()
  const rows = await db.workspaceDocument.findMany({
    where: {
      orgId: ctx.orgId,
      ...(opts?.folderId === undefined
        ? {}
        : opts.folderId === null
          ? { folderId: null }
          : { folderId: opts.folderId }),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { originalName: { contains: query, mode: 'insensitive' } },
              { notes: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: SELECT,
    orderBy: { createdAt: 'desc' },
    take: MAX_FILES,
  })
  return rows.map(mapRow)
}

export async function countUnfiled(ctx: OrgContext): Promise<number> {
  return db.workspaceDocument.count({ where: { orgId: ctx.orgId, folderId: null } })
}

/** Small-file path kept for local/dev convenience; production UI uses prepare + complete. */
export async function uploadDocument(
  ctx: OrgContext,
  file: File,
  meta: { title?: string | null; notes?: string | null; folderId?: string | null },
) {
  if (!(file instanceof File) || file.size <= 0) {
    throw validation('Choose a PDF or image to upload.', { file: ['Choose a file'] })
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw validation('Each file must be 100 MB or smaller.', { file: ['100 MB or smaller'] })
  }

  const count = await db.workspaceDocument.count({ where: { orgId: ctx.orgId } })
  if (count >= MAX_FILES) {
    throw validation(`This company already has ${MAX_FILES} documents. Delete some before uploading more.`)
  }

  const folderId = await assertFolderInOrg(ctx, meta.folderId)
  const bytes = Buffer.from(await file.arrayBuffer())
  const sniffed = sniff(bytes)
  if (!sniffed || !ALLOWED.has(sniffed.contentType)) {
    throw validation('Upload a PDF, JPEG, PNG, or WebP.', { file: ['PDF or image only'] })
  }

  const originalName = file.name.slice(0, 180) || `document.${sniffed.extension}`
  const title = (meta.title?.trim() || originalName).slice(0, 200)
  const storageKey = `${ctx.orgId}/${randomBytes(16).toString('hex')}.${sniffed.extension}`

  await putStoredObject(objectKey(storageKey), bytes, sniffed.contentType)

  try {
    const row = await db.workspaceDocument.create({
      data: {
        orgId: ctx.orgId,
        folderId,
        title,
        originalName,
        contentType: sniffed.contentType,
        byteSize: bytes.length,
        storageKey,
        notes: meta.notes?.trim() ? meta.notes.trim().slice(0, 4000) : null,
        createdById: ctx.userId,
      },
      select: SELECT,
    })
    return mapRow(row)
  } catch (error) {
    await deleteStoredObject(objectKey(storageKey)).catch(() => undefined)
    throw error
  }
}

/**
 * Step 1 of large uploads: mint a short-lived R2 PUT URL.
 * The browser writes the bytes; the serverless function never sees the body.
 */
export async function prepareDocumentUpload(
  ctx: OrgContext,
  input: {
    fileName: string
    contentType: string
    byteSize: number
  },
) {
  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) {
    throw validation('Choose a PDF or image to upload.', { file: ['Choose a file'] })
  }
  if (input.byteSize > MAX_DOCUMENT_BYTES) {
    throw validation('Each file must be 100 MB or smaller.', { file: ['100 MB or smaller'] })
  }

  const declared = normalizeDeclaredType(input.contentType, input.fileName)
  if (!declared) {
    throw validation('Upload a PDF, JPEG, PNG, or WebP.', { file: ['PDF or image only'] })
  }
  const extension = ALLOWED.get(declared)!

  const count = await db.workspaceDocument.count({ where: { orgId: ctx.orgId } })
  if (count >= MAX_FILES) {
    throw validation(`This company already has ${MAX_FILES} documents. Delete some before uploading more.`)
  }

  const storageKey = `${ctx.orgId}/${randomBytes(16).toString('hex')}.${extension}`
  const uploadUrl = await createPresignedPutUrl(objectKey(storageKey), declared)

  return {
    uploadUrl,
    storageKey,
    contentType: declared,
    fileName: input.fileName.slice(0, 180) || `document.${extension}`,
  }
}

/** Step 2: verify the object in R2, sniff magic bytes, then insert the library row. */
export async function completeDocumentUpload(
  ctx: OrgContext,
  input: {
    storageKey: string
    fileName: string
    contentType: string
    byteSize: number
    title?: string | null
    notes?: string | null
    folderId?: string | null
  },
) {
  const storageKey = input.storageKey.trim()
  if (!storageKey.startsWith(`${ctx.orgId}/`) || storageKey.includes('..')) {
    throw validation('Upload session expired. Try again.', { file: ['Invalid upload'] })
  }

  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0 || input.byteSize > MAX_DOCUMENT_BYTES) {
    throw validation('Each file must be 100 MB or smaller.', { file: ['100 MB or smaller'] })
  }

  const declared = normalizeDeclaredType(input.contentType, input.fileName)
  if (!declared) {
    throw validation('Upload a PDF, JPEG, PNG, or WebP.', { file: ['PDF or image only'] })
  }

  const folderId = await assertFolderInOrg(ctx, input.folderId)

  const key = objectKey(storageKey)
  let head: { contentLength: number; contentType?: string }
  try {
    head = await headStoredObject(key)
  } catch {
    throw validation('Upload did not finish. Try again.', { file: ['Upload incomplete'] })
  }

  if (head.contentLength <= 0 || head.contentLength > MAX_DOCUMENT_BYTES) {
    await deleteStoredObject(key).catch(() => undefined)
    throw validation('Each file must be 100 MB or smaller.', { file: ['100 MB or smaller'] })
  }

  // Allow a small mismatch if the client reported before compression; trust R2 size.
  if (Math.abs(head.contentLength - input.byteSize) > 64 * 1024 && head.contentLength !== input.byteSize) {
    // Still accept when the object is within the hard cap — client size is advisory.
  }

  const prefix = await getStoredObjectRange(key, 0, 15)
  const sniffed = sniff(prefix)
  if (!sniffed || sniffed.contentType !== declared) {
    await deleteStoredObject(key).catch(() => undefined)
    throw validation('Upload a PDF, JPEG, PNG, or WebP.', { file: ['File contents do not match type'] })
  }

  const count = await db.workspaceDocument.count({ where: { orgId: ctx.orgId } })
  if (count >= MAX_FILES) {
    await deleteStoredObject(key).catch(() => undefined)
    throw validation(`This company already has ${MAX_FILES} documents. Delete some before uploading more.`)
  }

  const originalName = input.fileName.slice(0, 180) || `document.${sniffed.extension}`
  const title = (input.title?.trim() || originalName).slice(0, 200)

  try {
    const row = await db.workspaceDocument.create({
      data: {
        orgId: ctx.orgId,
        folderId,
        title,
        originalName,
        contentType: sniffed.contentType,
        byteSize: head.contentLength,
        storageKey,
        notes: input.notes?.trim() ? input.notes.trim().slice(0, 4000) : null,
        createdById: ctx.userId,
      },
      select: SELECT,
    })
    return mapRow(row)
  } catch (error) {
    await deleteStoredObject(key).catch(() => undefined)
    throw error
  }
}

export async function updateDocument(
  ctx: OrgContext,
  id: string,
  input: { title: string; notes?: string | null; folderId?: string | null },
) {
  const existing = await db.workspaceDocument.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!existing) throw notFound('Document')

  const folderId =
    input.folderId === undefined ? undefined : await assertFolderInOrg(ctx, input.folderId)

  const row = await db.workspaceDocument.update({
    where: { id },
    data: {
      title: input.title.trim().slice(0, 200),
      notes: input.notes?.trim() ? input.notes.trim().slice(0, 4000) : null,
      ...(folderId !== undefined ? { folderId } : {}),
    },
    select: SELECT,
  })
  return mapRow(row)
}

export async function moveDocument(ctx: OrgContext, id: string, folderId: string | null) {
  const existing = await db.workspaceDocument.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!existing) throw notFound('Document')
  const nextFolderId = await assertFolderInOrg(ctx, folderId)
  const row = await db.workspaceDocument.update({
    where: { id },
    data: { folderId: nextFolderId },
    select: SELECT,
  })
  return mapRow(row)
}

export async function readDocument(ctx: OrgContext, id: string) {
  const file = await db.workspaceDocument.findFirst({
    where: { id, orgId: ctx.orgId },
  })
  if (!file) throw notFound('Document')
  const bytes = await getStoredObject(objectKey(file.storageKey))
  return { file, bytes }
}

export async function streamDocument(ctx: OrgContext, id: string) {
  const file = await db.workspaceDocument.findFirst({
    where: { id, orgId: ctx.orgId },
  })
  if (!file) throw notFound('Document')
  const stream = await streamStoredObject(objectKey(file.storageKey))
  return { file, ...stream }
}

export async function removeDocument(ctx: OrgContext, id: string) {
  const file = await db.workspaceDocument.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, storageKey: true },
  })
  if (!file) throw notFound('Document')
  await db.workspaceDocument.delete({ where: { id: file.id } })
  await deleteStoredObject(objectKey(file.storageKey))
  return { id: file.id }
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
