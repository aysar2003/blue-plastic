import 'server-only'
import type { DocumentType } from '@prisma/client'

import type { Tx } from '@/server/db'
import { validation } from '@/server/errors'

const DEFAULT_PREFIX: Record<DocumentType, string> = {
  JOURNAL: 'JE-',
  INVOICE: 'INV-',
  ESTIMATE: 'EST-',
  SALES_RECEIPT: 'SR-',
  CREDIT_MEMO: 'CM-',
  CUSTOMER_PAYMENT: 'PMT-',
  REFUND_RECEIPT: 'RFD-',
  BILL: 'BILL-',
  BILL_PAYMENT: 'BP-',
  EXPENSE: 'EXP-',
  VENDOR_CREDIT: 'VC-',
  PURCHASE_ORDER: 'PO-',
  TRANSFER: 'TRF-',
  DEPOSIT: 'DEP-',
  INVENTORY_ADJUSTMENT: 'ADJ-',
}

/**
 * Allocate the next document number.
 *
 * The `UPDATE … RETURNING` takes a row lock for the duration of the caller's
 * transaction, so two concurrent invoices cannot receive the same number. Doing
 * this with a read-then-write in application code would be a race with a very
 * quiet failure mode: two documents, one number, discovered at year end.
 *
 * Numbers are allocated inside the caller's transaction, which means a rolled-back
 * document consumes a number. That is deliberate — a gap in a sequence is a
 * non-event, whereas a duplicate is an audit finding.
 */
export async function nextDocumentNumber(
  tx: Tx,
  orgId: string,
  docType: DocumentType,
): Promise<string> {
  // Column names are Prisma's camelCase field names (only tables are mapped to
  // snake_case), so they must be double-quoted here.
  const rows = await tx.$queryRaw<{ prefix: string; allocated: number; padding: number }[]>`
    UPDATE document_sequences
       SET "nextNumber" = "nextNumber" + 1,
           "updatedAt"  = now()
     WHERE "orgId"   = ${orgId}
       AND "docType" = ${docType}::"DocumentType"
    RETURNING prefix, "nextNumber" - 1 AS allocated, padding
  `

  if (rows.length > 0) {
    const { prefix, allocated, padding } = rows[0]
    return format(prefix, Number(allocated), padding)
  }

  // First document of this type for this organisation.
  const created = await tx.documentSequence.create({
    data: { orgId, docType, prefix: DEFAULT_PREFIX[docType], nextNumber: 2, padding: 5 },
  })
  return format(created.prefix, 1, created.padding)
}

/**
 * What the next number will be, without taking it.
 *
 * For showing on a form before anything is saved. It is a preview and nothing
 * more: the real number is allocated under a row lock at the moment of posting,
 * so if somebody else posts first this one moves on. Reserving it here instead
 * would burn a number every time a form was opened and abandoned.
 */
export async function peekDocumentNumber(
  client: Tx,
  orgId: string,
  docType: DocumentType,
): Promise<string> {
  const sequence = await client.documentSequence.findFirst({
    where: { orgId, docType },
    select: { prefix: true, nextNumber: true, padding: true },
  })

  if (!sequence) return format(DEFAULT_PREFIX[docType], 1, 5)
  return format(sequence.prefix, sequence.nextNumber, sequence.padding)
}

function format(prefix: string, value: number, padding: number): string {
  return `${prefix}${String(value).padStart(padding, '0')}`
}

type SequenceRow = { prefix: string; nextNumber: number; padding: number }

/** Lock the sequence row for the rest of the caller's transaction. */
async function lockSequence(tx: Tx, orgId: string, docType: DocumentType): Promise<SequenceRow> {
  const rows = await tx.$queryRaw<SequenceRow[]>`
    UPDATE document_sequences
       SET "updatedAt" = now()
     WHERE "orgId"   = ${orgId}
       AND "docType" = ${docType}::"DocumentType"
    RETURNING prefix, "nextNumber", padding
  `

  if (rows.length > 0) {
    return {
      prefix: rows[0].prefix,
      nextNumber: Number(rows[0].nextNumber),
      padding: Number(rows[0].padding),
    }
  }

  await tx.documentSequence.create({
    data: { orgId, docType, prefix: DEFAULT_PREFIX[docType], nextNumber: 1, padding: 5 },
  })
  return lockSequence(tx, orgId, docType)
}

/** The digits of a typed number, whether they wrote `50` or `INV-00050`. */
function parseSerial(wanted: string, prefix: string): number | null {
  const body = /^\d+$/.test(wanted)
    ? wanted
    : prefix && wanted.toLowerCase().startsWith(prefix.toLowerCase())
      ? wanted.slice(prefix.length)
      : ''
  if (!/^\d+$/.test(body)) return null
  const serial = Number(body)
  if (!Number.isSafeInteger(serial) || serial < 1 || serial > 999_999_999) return null
  return serial
}

/**
 * The number this document will carry.
 *
 * Blank takes the next one. A number the user typed is kept, and if it is
 * further along than the sequence, the next document continues after it.
 */
export async function assignDocumentNumber(
  tx: Tx,
  orgId: string,
  docType: DocumentType,
  requested?: string | null,
): Promise<string> {
  const sequence = await lockSequence(tx, orgId, docType)
  const wanted = requested?.trim() ?? ''
  const natural = format(sequence.prefix, sequence.nextNumber, sequence.padding)
  const where = { orgId_docType: { orgId, docType } }

  if (!wanted) {
    await tx.documentSequence.update({ where, data: { nextNumber: sequence.nextNumber + 1 } })
    return natural
  }

  if (/^\d+$/.test(wanted) && parseSerial(wanted, sequence.prefix) === null) {
    throw validation('Enter a number from 1 up.', { number: ['Enter a number from 1 up.'] })
  }

  const serial = parseSerial(wanted, sequence.prefix)
  const stored = serial !== null ? format(sequence.prefix, serial, sequence.padding) : wanted

  if (stored.toLowerCase() === natural.toLowerCase()) {
    await tx.documentSequence.update({ where, data: { nextNumber: sequence.nextNumber + 1 } })
    return natural
  }

  if (serial !== null && serial > sequence.nextNumber) {
    await tx.documentSequence.update({ where, data: { nextNumber: serial + 1 } })
  }

  return stored
}

export function numberTaken() {
  const message = 'That number is already used.'
  return validation(message, { number: [message] })
}

/** Seed the default sequences for a new organisation. */
export async function createDefaultSequences(tx: Tx, orgId: string): Promise<void> {
  await tx.documentSequence.createMany({
    data: (Object.keys(DEFAULT_PREFIX) as DocumentType[]).map((docType) => ({
      orgId,
      docType,
      prefix: DEFAULT_PREFIX[docType],
      nextNumber: 1,
      padding: 5,
    })),
    skipDuplicates: true,
  })
}

export { DEFAULT_PREFIX }
