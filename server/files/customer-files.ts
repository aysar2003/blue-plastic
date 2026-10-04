import 'server-only'

import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { CustomerFileKind } from '@prisma/client'

import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

const ROOT = path.resolve(process.cwd(), 'uploads')
const MAX_PHOTO = 3 * 1024 * 1024
const MAX_PAPER = 4 * 1024 * 1024
const MAX_PAPERS = 4

type Sniffed = { contentType: string; extension: string }

const FILE_SELECT = {
  id: true,
  kind: true,
  originalName: true,
  contentType: true,
  byteSize: true,
  createdAt: true,
} as const

export type CustomerFileRow = {
  id: string
  kind: CustomerFileKind
  originalName: string
  contentType: string
  byteSize: number
  createdAt: Date
}

export function readCustomerUploads(formData: FormData): { photo: File | null; agreements: File[] } {
  const photo = formData.get('photo')
  const agreements = formData.getAll('agreements').filter(isUpload)
  return {
    photo: isUpload(photo) ? photo : null,
    agreements,
  }
}

/** Reject a file before the customer is created, so a bad upload does not leave a person behind. */
export function uploadProblem(
  uploads: { photo: File | null; agreements: File[] },
  existingPapers: number,
): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {}
  if (uploads.photo && uploads.photo.size > MAX_PHOTO) {
    errors.photo = ['The photo must be 3 MB or smaller.']
  }
  if (uploads.agreements.length + existingPapers > MAX_PAPERS) {
    errors.agreements = [`Keep at most ${MAX_PAPERS} agreement papers.`]
  }
  if (uploads.agreements.some((file) => file.size > MAX_PAPER)) {
    errors.agreements = ['Each agreement paper must be 4 MB or smaller.']
  }
  return Object.keys(errors).length > 0 ? errors : null
}

export async function listCustomerFiles(ctx: OrgContext, customerId: string): Promise<CustomerFileRow[]> {
  return db.customerFile.findMany({
    where: { orgId: ctx.orgId, customerId },
    select: FILE_SELECT,
    orderBy: { createdAt: 'asc' },
  })
}

export async function storeCustomerUploads(
  ctx: OrgContext,
  customerId: string,
  uploads: { photo: File | null; agreements: File[] },
) {
  if (!uploads.photo && uploads.agreements.length === 0) return

  const customer = await db.customer.findFirst({
    where: { id: customerId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!customer) throw notFound('Customer')

  const already = await db.customerFile.count({
    where: { orgId: ctx.orgId, customerId, kind: 'AGREEMENT' },
  })
  if (already + uploads.agreements.length > MAX_PAPERS) {
    throw validation(`Keep at most ${MAX_PAPERS} agreement papers.`, {
      agreements: [`Keep at most ${MAX_PAPERS} agreement papers.`],
    })
  }

  if (uploads.photo) {
    const previous = await db.customerFile.findMany({
      where: { orgId: ctx.orgId, customerId, kind: 'PHOTO' },
      select: { id: true, storageKey: true },
    })
    await writeOne(ctx, customerId, 'PHOTO', uploads.photo, imageOnly)
    if (previous.length > 0) {
      await db.customerFile.deleteMany({ where: { id: { in: previous.map((file) => file.id) } } })
      await Promise.all(previous.map((file) => removeStored(file.storageKey)))
    }
  }

  for (const paper of uploads.agreements) {
    await writeOne(ctx, customerId, 'AGREEMENT', paper, paperOrImage)
  }
}

export async function readCustomerFile(ctx: OrgContext, customerId: string, fileId: string) {
  const file = await db.customerFile.findFirst({
    where: { id: fileId, customerId, orgId: ctx.orgId },
  })
  if (!file) throw notFound('File')
  const bytes = await readFile(absolutePath(file.storageKey))
  return { file, bytes }
}

export async function removeCustomerFile(ctx: OrgContext, customerId: string, fileId: string) {
  const file = await db.customerFile.findFirst({
    where: { id: fileId, customerId, orgId: ctx.orgId },
    select: { id: true, storageKey: true },
  })
  if (!file) throw notFound('File')
  await db.customerFile.delete({ where: { id: file.id } })
  await removeStored(file.storageKey)
}

function isUpload(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.name !== ''
}

async function writeOne(
  ctx: OrgContext,
  customerId: string,
  kind: CustomerFileKind,
  file: File,
  allow: (sniffed: Sniffed) => boolean,
) {
  const bytes = Buffer.from(await file.arrayBuffer())
  const sniffed = sniff(bytes)
  if (!sniffed || !allow(sniffed)) {
    throw validation(
      kind === 'PHOTO'
        ? 'The photo must be a JPEG, PNG, or WebP image.'
        : 'An agreement paper must be a PDF, JPEG, PNG, or WebP file.',
      { [kind === 'PHOTO' ? 'photo' : 'agreements']: ['That file type is not allowed.'] },
    )
  }

  const id = randomBytes(16).toString('hex')
  // Keep this a plain relative key — path.join with only dynamic segments makes
  // Turbopack file-trace the whole repo and blows past Vercel function size limits.
  const storageKey = `${ctx.orgId}/${customerId}/${id}.${sniffed.extension}`
  const destination = absolutePath(storageKey)
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, bytes)

  try {
    return await db.customerFile.create({
      data: {
        orgId: ctx.orgId,
        customerId,
        kind,
        originalName: safeName(file.name),
        contentType: sniffed.contentType,
        byteSize: bytes.length,
        storageKey,
        createdById: ctx.userId,
      },
      select: { id: true },
    })
  } catch (error) {
    await removeStored(storageKey)
    throw error
  }
}

function imageOnly(sniffed: Sniffed) {
  return sniffed.contentType.startsWith('image/')
}

function paperOrImage(sniffed: Sniffed) {
  return sniffed.contentType.startsWith('image/') || sniffed.contentType === 'application/pdf'
}

function sniff(bytes: Buffer): Sniffed | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: 'jpg' }
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { contentType: 'image/png', extension: 'png' }
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { contentType: 'image/webp', extension: 'webp' }
  }
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') {
    return { contentType: 'application/pdf', extension: 'pdf' }
  }
  return null
}

function absolutePath(storageKey: string) {
  const full = path.resolve(/*turbopackIgnore: true*/ ROOT, storageKey)
  const relative = path.relative(/*turbopackIgnore: true*/ ROOT, full)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw validation('That file could not be read.')
  }
  return full
}

async function removeStored(storageKey: string) {
  await unlink(absolutePath(storageKey)).catch(() => undefined)
}

function safeName(name: string) {
  const base = path.basename(name).replace(/[\r\n"]/g, '').trim()
  return (base || 'file').slice(0, 180)
}
