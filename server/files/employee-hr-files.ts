import 'server-only'

import { randomBytes } from 'node:crypto'
import path from 'node:path'

import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'
import { deleteStoredObject, getStoredObject, putStoredObject } from '@/server/files/object-store'

const CONTRACT_PREFIX = 'employee-contracts'
const DOCUMENT_PREFIX = 'employee-documents'
const POLICY_PREFIX = 'hr-policies'
const MAX_BYTES = 8 * 1024 * 1024

type Sniffed = { contentType: string; extension: string }

function isUpload(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.name !== ''
}

export function readHrUpload(formData: FormData, field = 'file'): File | null {
  const value = formData.get(field)
  return isUpload(value) ? value : null
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

function safeName(name: string) {
  const base = path.basename(name).replace(/[\r\n"]/g, '').trim()
  return (base || 'file').slice(0, 180)
}

async function storeBytes(
  prefix: string,
  storageKey: string,
  file: File,
): Promise<{ originalName: string; contentType: string; byteSize: number; storageKey: string }> {
  if (file.size > MAX_BYTES) {
    throw validation('File must be 8 MB or smaller.', { file: ['Too large'] })
  }
  const bytes = Buffer.from(await file.arrayBuffer())
  const sniffed = sniff(bytes)
  if (!sniffed) {
    throw validation('Use a PDF, JPEG, PNG, or WebP file.', { file: ['Invalid type'] })
  }
  const key = `${storageKey}.${sniffed.extension}`
  await putStoredObject(`${prefix}/${key}`, bytes, sniffed.contentType)
  return {
    originalName: safeName(file.name),
    contentType: sniffed.contentType,
    byteSize: bytes.length,
    storageKey: key,
  }
}

export async function attachContractFile(ctx: OrgContext, contractId: string, file: File) {
  const row = await db.employeeContract.findFirst({
    where: { id: contractId, orgId: ctx.orgId },
    select: { id: true, employeeId: true, storageKey: true },
  })
  if (!row) throw notFound('Contract')

  const id = randomBytes(16).toString('hex')
  const stored = await storeBytes(
    CONTRACT_PREFIX,
    `${ctx.orgId}/${row.employeeId}/${contractId}/${id}`,
    file,
  )

  try {
    await db.employeeContract.update({
      where: { id: contractId },
      data: {
        originalName: stored.originalName,
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        storageKey: stored.storageKey,
      },
    })
  } catch (error) {
    await deleteStoredObject(`${CONTRACT_PREFIX}/${stored.storageKey}`)
    throw error
  }

  if (row.storageKey) {
    await deleteStoredObject(`${CONTRACT_PREFIX}/${row.storageKey}`).catch(() => undefined)
  }
}

export async function readContractFile(ctx: OrgContext, contractId: string) {
  const row = await db.employeeContract.findFirst({
    where: { id: contractId, orgId: ctx.orgId },
  })
  if (!row?.storageKey) throw notFound('Contract file')
  const bytes = await getStoredObject(`${CONTRACT_PREFIX}/${row.storageKey}`)
  return { file: row, bytes }
}

export async function storeEmployeeDocument(
  ctx: OrgContext,
  employeeId: string,
  input: { kind: 'CONTRACT' | 'ID' | 'CERTIFICATE' | 'OTHER'; title: string; notes?: string | null },
  file: File,
) {
  const employee = await db.employee.findFirst({
    where: { id: employeeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!employee) throw notFound('Employee')

  const id = randomBytes(16).toString('hex')
  const stored = await storeBytes(DOCUMENT_PREFIX, `${ctx.orgId}/${employeeId}/${id}`, file)

  try {
    return await db.employeeDocument.create({
      data: {
        orgId: ctx.orgId,
        employeeId,
        kind: input.kind,
        title: input.title,
        notes: input.notes ?? null,
        originalName: stored.originalName,
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        storageKey: stored.storageKey,
        createdById: ctx.userId,
      },
    })
  } catch (error) {
    await deleteStoredObject(`${DOCUMENT_PREFIX}/${stored.storageKey}`)
    throw error
  }
}

export async function readEmployeeDocument(ctx: OrgContext, employeeId: string, documentId: string) {
  const row = await db.employeeDocument.findFirst({
    where: { id: documentId, employeeId, orgId: ctx.orgId },
  })
  if (!row) throw notFound('Document')
  const bytes = await getStoredObject(`${DOCUMENT_PREFIX}/${row.storageKey}`)
  return { file: row, bytes }
}

export async function removeEmployeeDocument(ctx: OrgContext, employeeId: string, documentId: string) {
  const row = await db.employeeDocument.findFirst({
    where: { id: documentId, employeeId, orgId: ctx.orgId },
    select: { id: true, storageKey: true },
  })
  if (!row) throw notFound('Document')
  await db.employeeDocument.delete({ where: { id: row.id } })
  await deleteStoredObject(`${DOCUMENT_PREFIX}/${row.storageKey}`).catch(() => undefined)
}

export async function attachPolicyFile(ctx: OrgContext, policyId: string, file: File) {
  const row = await db.hrPolicy.findFirst({
    where: { id: policyId, orgId: ctx.orgId },
    select: { id: true, storageKey: true },
  })
  if (!row) throw notFound('Policy')

  const id = randomBytes(16).toString('hex')
  const stored = await storeBytes(POLICY_PREFIX, `${ctx.orgId}/${policyId}/${id}`, file)

  try {
    await db.hrPolicy.update({
      where: { id: policyId },
      data: {
        originalName: stored.originalName,
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        storageKey: stored.storageKey,
      },
    })
  } catch (error) {
    await deleteStoredObject(`${POLICY_PREFIX}/${stored.storageKey}`)
    throw error
  }

  if (row.storageKey) {
    await deleteStoredObject(`${POLICY_PREFIX}/${row.storageKey}`).catch(() => undefined)
  }
}

export async function readPolicyFile(ctx: OrgContext, policyId: string) {
  const row = await db.hrPolicy.findFirst({ where: { id: policyId, orgId: ctx.orgId } })
  if (!row?.storageKey) throw notFound('Policy file')
  const bytes = await getStoredObject(`${POLICY_PREFIX}/${row.storageKey}`)
  return { file: row, bytes }
}

export async function clearPolicyFile(ctx: OrgContext, policyId: string) {
  const row = await db.hrPolicy.findFirst({
    where: { id: policyId, orgId: ctx.orgId },
    select: { id: true, storageKey: true },
  })
  if (!row) throw notFound('Policy')
  await db.hrPolicy.update({
    where: { id: policyId },
    data: { originalName: null, contentType: null, byteSize: null, storageKey: null },
  })
  if (row.storageKey) {
    await deleteStoredObject(`${POLICY_PREFIX}/${row.storageKey}`).catch(() => undefined)
  }
}
