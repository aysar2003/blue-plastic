import 'server-only'

import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

const ROOT = path.resolve(process.cwd(), 'uploads', 'branding')
const MAX = 2 * 1024 * 1024

const ALLOWED = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

function sniff(bytes: Buffer): { contentType: string; extension: string } | null {
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

export async function storeOrgLogo(ctx: OrgContext, file: File) {
  if (file.size <= 0 || file.size > MAX) throw validation('Choose a logo image of 2 MB or smaller.')
  const bytes = Buffer.from(await file.arrayBuffer())
  const sniffed = sniff(bytes)
  if (!sniffed || !ALLOWED.has(sniffed.contentType)) {
    throw validation('Use a JPEG, PNG, or WebP logo.')
  }

  const before = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: { logoStorageKey: true },
  })
  if (!before) throw notFound('Organisation')

  const storageKey = `${ctx.orgId}/${randomBytes(12).toString('hex')}.${sniffed.extension}`
  await mkdir(path.join(/*turbopackIgnore: true*/ ROOT, ctx.orgId), { recursive: true })
  await writeFile(path.join(/*turbopackIgnore: true*/ ROOT, storageKey), bytes)

  await db.organization.update({
    where: { id: ctx.orgId },
    data: {
      logoStorageKey: storageKey,
      logoContentType: sniffed.contentType,
    },
  })

  if (before.logoStorageKey && before.logoStorageKey !== storageKey) {
    await unlink(path.join(/*turbopackIgnore: true*/ ROOT, before.logoStorageKey)).catch(() => undefined)
  }

  return { storageKey, contentType: sniffed.contentType }
}

export async function clearOrgLogo(ctx: OrgContext) {
  const before = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: { logoStorageKey: true },
  })
  if (!before) throw notFound('Organisation')

  await db.organization.update({
    where: { id: ctx.orgId },
    data: { logoStorageKey: null, logoContentType: null },
  })

  if (before.logoStorageKey) {
    await unlink(path.join(/*turbopackIgnore: true*/ ROOT, before.logoStorageKey)).catch(() => undefined)
  }
}

export async function readOrgLogo(ctx: OrgContext) {
  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: { logoStorageKey: true, logoContentType: true, name: true },
  })
  if (!org?.logoStorageKey || !org.logoContentType) throw notFound('Logo')
  const bytes = await readFile(path.join(/*turbopackIgnore: true*/ ROOT, org.logoStorageKey))
  return {
    bytes,
    contentType: org.logoContentType,
    filename: `${org.name.replace(/[^\w.-]+/g, '-').slice(0, 40) || 'logo'}.png`,
  }
}
