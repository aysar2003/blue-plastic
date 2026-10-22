import 'server-only'

import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

const ROOT = path.resolve(process.cwd(), 'uploads', 'company-agreements')
const MAX_BYTES = 8 * 1024 * 1024

type Sniffed = { contentType: string; extension: string }

export async function storeAgreementFile(
  ctx: OrgContext,
  orgId: string,
  agreementId: string,
  file: File,
) {
  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length > MAX_BYTES) {
    throw validation('Each agreement file must be 8 MB or smaller.')
  }
  const sniffed = sniff(bytes)
  if (!sniffed || !paperOrImage(sniffed)) {
    throw validation('An agreement must be a PDF, JPEG, PNG, or WebP file.')
  }

  const id = randomBytes(16).toString('hex')
  const storageKey = `${orgId}/${agreementId}/${id}.${sniffed.extension}`
  const destination = absolutePath(storageKey)
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, bytes)

  return {
    originalName: safeName(file.name),
    contentType: sniffed.contentType,
    byteSize: bytes.length,
    storageKey,
    createdById: ctx.userId,
  }
}

export async function readAgreementBytes(storageKey: string) {
  return readFile(absolutePath(storageKey))
}

export async function removeAgreementStored(storageKey: string | null | undefined) {
  if (!storageKey) return
  await unlink(absolutePath(storageKey)).catch(() => undefined)
}

export async function assertAgreementOrg(orgId: string, agreementId: string) {
  const row = await db.companyAgreement.findFirst({
    where: { id: agreementId, orgId },
  })
  if (!row) throw notFound('Agreement')
  return row
}

function paperOrImage(sniffed: Sniffed) {
  return sniffed.contentType.startsWith('image/') || sniffed.contentType === 'application/pdf'
}

function sniff(bytes: Buffer): Sniffed | null {
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

function safeName(name: string) {
  const base = path.basename(name).replace(/[\r\n"]/g, '').trim()
  return (base || 'file').slice(0, 180)
}
