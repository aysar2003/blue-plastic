import 'server-only'

import { randomBytes } from 'node:crypto'
import path from 'node:path'

import { validation } from '@/server/errors'
import { deleteStoredObject, getStoredObject, putStoredObject } from '@/server/files/object-store'

const PREFIX = 'rent-payments'
const MAX_BYTES = 8 * 1024 * 1024

type Sniffed = { contentType: string; extension: string }

function objectKey(storageKey: string) {
  return `${PREFIX}/${storageKey}`
}

export async function storeRentPaymentReceipt(
  orgId: string,
  paymentId: string,
  file: File,
) {
  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length > MAX_BYTES) {
    throw validation('Each receipt must be 8 MB or smaller.')
  }
  const sniffed = sniff(bytes)
  if (!sniffed || !paperOrImage(sniffed)) {
    throw validation('A receipt must be a PDF, JPEG, PNG, or WebP file.')
  }

  const id = randomBytes(16).toString('hex')
  const storageKey = `${orgId}/${paymentId}/${id}.${sniffed.extension}`
  await putStoredObject(objectKey(storageKey), bytes, sniffed.contentType)

  return {
    originalName: safeName(file.name),
    contentType: sniffed.contentType,
    byteSize: bytes.length,
    storageKey,
  }
}

export async function readRentPaymentBytes(storageKey: string) {
  return getStoredObject(objectKey(storageKey))
}

export async function removeRentPaymentStored(storageKey: string | null | undefined) {
  if (!storageKey) return
  await deleteStoredObject(objectKey(storageKey))
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

function safeName(name: string) {
  const base = path.basename(name).replace(/[\r\n"]/g, '').trim()
  return (base || 'file').slice(0, 180)
}
