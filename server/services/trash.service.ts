import 'server-only'

import { purchaseByType } from '@/lib/purchase-types'
import { byType as salesByType } from '@/lib/sales-types'
import { letterheadOf } from '@/lib/letterhead'
import { formatMoney } from '@/lib/money'
import type { PrintInk } from '@/lib/print-ink'
import {
  isHiddenFromTrash,
  presentTrashEntry,
  trashOrigin,
  trashRestoreCapability,
  TRASH_RESTORABLE,
} from '@/lib/trash-log'
import { toCalendarDate } from '@/lib/date'
import { purgeDeletedEntity, trashPurgeOrder } from '@/server/accounting/purge-deleted'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition } from '@/server/errors'
import { listTrashFiles, removeTrashFilesForLogs } from '@/server/files/trash-files'
import { renderSalesDocumentPdf } from '@/server/reports/sales-document-pdf'
import { renderTrashRecordPdf } from '@/server/reports/trash-record-pdf'
import * as assemblyBuildService from '@/server/services/assembly-build.service'
import * as bankingService from '@/server/services/banking.service'
import * as billPaymentService from '@/server/services/bill-payment.service'
import * as inventoryService from '@/server/services/inventory.service'
import * as journalService from '@/server/services/journal.service'
import * as organizationService from '@/server/services/organization.service'
import * as paymentService from '@/server/services/payment.service'
import * as purchaseService from '@/server/services/purchase.service'
import * as salesService from '@/server/services/sales.service'

function recordOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

async function loadDeleteLog(ctx: OrgContext, id: string) {
  const row = await db.auditLog.findFirst({
    where: { id, orgId: ctx.orgId, action: 'DELETE' },
    select: {
      id: true,
      entity: true,
      entityId: true,
      at: true,
      before: true,
      after: true,
      actor: { select: { name: true, email: true } },
    },
  })
  if (!row) throw notFound('Trash entry')
  return row
}

function afterRecord(after: unknown): Record<string, unknown> | null {
  return recordOf(after)
}

function isRestored(after: unknown): boolean {
  return afterRecord(after)?.restored === true
}

function isCleared(after: unknown): boolean {
  return afterRecord(after)?.cleared === true
}

function isGoneFromTrash(after: unknown): boolean {
  return isHiddenFromTrash(after)
}

/** Reason stamped on the soft-deleted row when the audit line omitted it. */
async function rowDeleteReason(
  ctx: OrgContext,
  entity: string,
  entityId: string,
): Promise<string | null> {
  const pick = (value: string | null | undefined) => {
    const trimmed = value?.trim()
    return trimmed || null
  }

  // Soft-deleted models hide behind `deletedAt: null` unless we ask for both.
  const withDeleted = { id: entityId, orgId: ctx.orgId, deletedAt: undefined }

  switch (entity) {
    case 'SalesDocument': {
      const row = await db.salesDocument.findFirst({
        where: withDeleted,
        select: { deleteReason: true },
      })
      return pick(row?.deleteReason)
    }
    case 'PurchaseDocument': {
      const row = await db.purchaseDocument.findFirst({
        where: withDeleted,
        select: { deleteReason: true },
      })
      return pick(row?.deleteReason)
    }
    case 'Journal': {
      const row = await db.journal.findFirst({
        where: { id: entityId, orgId: ctx.orgId },
        select: { deleteReason: true },
      })
      return pick(row?.deleteReason)
    }
    case 'CustomerPayment': {
      const row = await db.customerPayment.findFirst({
        where: withDeleted,
        select: { deleteReason: true },
      })
      return pick(row?.deleteReason)
    }
    case 'BillPayment': {
      const row = await db.billPayment.findFirst({
        where: withDeleted,
        select: { deleteReason: true },
      })
      return pick(row?.deleteReason)
    }
    case 'BankTransfer': {
      const row = await db.bankTransfer.findFirst({
        where: withDeleted,
        select: { deleteReason: true },
      })
      return pick(row?.deleteReason)
    }
    case 'Deposit': {
      const row = await db.deposit.findFirst({
        where: withDeleted,
        select: { deleteReason: true },
      })
      return pick(row?.deleteReason)
    }
    case 'InventoryAdjustment': {
      const row = await db.inventoryAdjustment.findFirst({
        where: withDeleted,
        select: { deleteReason: true },
      })
      return pick(row?.deleteReason)
    }
    case 'AssemblyBuild': {
      const row = await db.assemblyBuild.findFirst({
        where: withDeleted,
        select: { deleteReason: true },
      })
      return pick(row?.deleteReason)
    }
    case 'Item': {
      const row = await db.item.findFirst({
        where: withDeleted,
        select: { deleteReason: true },
      })
      return pick(row?.deleteReason)
    }
    default:
      return null
  }
}

type SnapshotField = { label: string; value: string }

function auditBeforeSnapshot(before: Record<string, unknown>): SnapshotField[] {
  return Object.entries(before)
    .filter(([key]) => !/id$/i.test(key) && key !== 'applicationsReleased')
    .map(([key, value]) => ({
      label: key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()),
      value:
        value == null
          ? null
          : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : Array.isArray(value)
              ? value.map(String).join(', ')
              : null,
    }))
    .filter((field): field is SnapshotField => Boolean(field.value))
}

function moneyLabel(amount: { toString(): string }, currency: string) {
  return formatMoney(amount.toString(), currency)
}

/**
 * Rebuild the deleted record as form fields for Trash detail.
 * The audit `before` blob only keeps a few keys; the soft-deleted row still has the paper.
 */
async function formSnapshot(
  ctx: OrgContext,
  entity: string,
  entityId: string,
): Promise<SnapshotField[]> {
  const currencyFallback = ctx.organization.baseCurrency

  // Soft-delete extension hides these unless `deletedAt` is mentioned.
  const withDeleted = { id: entityId, orgId: ctx.orgId, deletedAt: undefined }

  if (entity === 'SalesDocument') {
    const document = await db.salesDocument.findFirst({
      where: withDeleted,
      select: {
        number: true,
        type: true,
        status: true,
        date: true,
        dueDate: true,
        currencyCode: true,
        subtotal: true,
        discountAmount: true,
        taxTotal: true,
        total: true,
        customerMessage: true,
        memo: true,
        customer: { select: { displayName: true, email: true } },
        lines: {
          orderBy: { lineNumber: 'asc' },
          select: {
            quantity: true,
            description: true,
            unitPrice: true,
            amount: true,
            item: { select: { sku: true, name: true } },
          },
        },
      },
    })
    if (!document) return []
    const currency = document.currencyCode || currencyFallback
    const fields: SnapshotField[] = [
      { label: 'Number', value: document.number },
      { label: 'Type', value: document.type },
      { label: 'Status', value: document.status },
      { label: 'Customer', value: document.customer.displayName },
      ...(document.customer.email
        ? [{ label: 'Customer email', value: document.customer.email }]
        : []),
      { label: 'Date', value: toCalendarDate(document.date) },
      ...(document.dueDate ? [{ label: 'Due date', value: toCalendarDate(document.dueDate) }] : []),
      { label: 'Currency', value: currency },
      ...document.lines.map((line, index) => ({
        label: `Line ${index + 1}`,
        value: [
          line.quantity.toString(),
          '×',
          line.description ?? line.item?.name ?? 'Line',
          line.item?.sku ? `(${line.item.sku})` : null,
          '=',
          moneyLabel(line.amount, currency),
        ]
          .filter(Boolean)
          .join(' '),
      })),
      { label: 'Subtotal', value: moneyLabel(document.subtotal, currency) },
      ...(document.discountAmount.toString() !== '0'
        ? [{ label: 'Discount', value: moneyLabel(document.discountAmount, currency) }]
        : []),
      ...(document.taxTotal.toString() !== '0'
        ? [{ label: 'Tax', value: moneyLabel(document.taxTotal, currency) }]
        : []),
      { label: 'Total', value: moneyLabel(document.total, currency) },
      ...(document.customerMessage
        ? [{ label: 'Message', value: document.customerMessage }]
        : []),
      ...(document.memo ? [{ label: 'Memo', value: document.memo }] : []),
    ]
    return fields
  }

  if (entity === 'PurchaseDocument') {
    const document = await db.purchaseDocument.findFirst({
      where: withDeleted,
      select: {
        number: true,
        type: true,
        status: true,
        date: true,
        dueDate: true,
        currencyCode: true,
        subtotal: true,
        taxTotal: true,
        total: true,
        memo: true,
        vendor: { select: { displayName: true, email: true } },
        lines: {
          orderBy: { lineNumber: 'asc' },
          select: {
            quantity: true,
            description: true,
            amount: true,
            item: { select: { sku: true, name: true } },
          },
        },
      },
    })
    if (!document) return []
    const currency = document.currencyCode || currencyFallback
    return [
      { label: 'Number', value: document.number },
      { label: 'Type', value: document.type },
      { label: 'Status', value: document.status },
      { label: 'Vendor', value: document.vendor.displayName },
      ...(document.vendor.email ? [{ label: 'Vendor email', value: document.vendor.email }] : []),
      { label: 'Date', value: toCalendarDate(document.date) },
      ...(document.dueDate ? [{ label: 'Due date', value: toCalendarDate(document.dueDate) }] : []),
      ...document.lines.map((line, index) => ({
        label: `Line ${index + 1}`,
        value: [
          line.quantity.toString(),
          '×',
          line.description ?? line.item?.name ?? 'Line',
          '=',
          moneyLabel(line.amount, currency),
        ].join(' '),
      })),
      { label: 'Subtotal', value: moneyLabel(document.subtotal, currency) },
      { label: 'Total', value: moneyLabel(document.total, currency) },
      ...(document.memo ? [{ label: 'Memo', value: document.memo }] : []),
    ]
  }

  if (entity === 'Journal') {
    const journal = await db.journal.findFirst({
      where: { id: entityId, orgId: ctx.orgId },
      select: {
        journalNumber: true,
        date: true,
        memo: true,
        lines: {
          orderBy: { lineNumber: 'asc' },
          select: {
            debit: true,
            credit: true,
            description: true,
            account: { select: { code: true, name: true } },
          },
        },
      },
    })
    if (!journal) return []
    return [
      { label: 'Number', value: journal.journalNumber },
      { label: 'Date', value: toCalendarDate(journal.date) },
      ...(journal.memo ? [{ label: 'Memo', value: journal.memo }] : []),
      ...journal.lines.map((line) => ({
        label: `${line.account.code} ${line.account.name}`,
        value: `Dr ${line.debit.toString()} / Cr ${line.credit.toString()}${
          line.description ? ` — ${line.description}` : ''
        }`,
      })),
    ]
  }

  if (entity === 'CustomerPayment') {
    const payment = await db.customerPayment.findFirst({
      where: withDeleted,
      select: {
        number: true,
        date: true,
        amount: true,
        currencyCode: true,
        memo: true,
        customer: { select: { displayName: true } },
      },
    })
    if (!payment) return []
    const currency = payment.currencyCode || currencyFallback
    return [
      { label: 'Number', value: payment.number },
      { label: 'Customer', value: payment.customer.displayName },
      { label: 'Date', value: toCalendarDate(payment.date) },
      { label: 'Amount', value: moneyLabel(payment.amount, currency) },
      ...(payment.memo ? [{ label: 'Memo', value: payment.memo }] : []),
    ]
  }

  if (entity === 'BillPayment') {
    const payment = await db.billPayment.findFirst({
      where: withDeleted,
      select: {
        number: true,
        date: true,
        amount: true,
        currencyCode: true,
        memo: true,
        vendor: { select: { displayName: true } },
      },
    })
    if (!payment) return []
    const currency = payment.currencyCode || currencyFallback
    return [
      { label: 'Number', value: payment.number },
      { label: 'Vendor', value: payment.vendor.displayName },
      { label: 'Date', value: toCalendarDate(payment.date) },
      { label: 'Amount', value: moneyLabel(payment.amount, currency) },
      ...(payment.memo ? [{ label: 'Memo', value: payment.memo }] : []),
    ]
  }

  if (entity === 'BankTransfer') {
    const transfer = await db.bankTransfer.findFirst({
      where: withDeleted,
      select: {
        number: true,
        date: true,
        amount: true,
        currencyCode: true,
        memo: true,
        reference: true,
        fromAccount: { select: { code: true, name: true } },
        toAccount: { select: { code: true, name: true } },
      },
    })
    if (!transfer) return []
    const currency = transfer.currencyCode || currencyFallback
    return [
      { label: 'Number', value: transfer.number },
      { label: 'Date', value: toCalendarDate(transfer.date) },
      {
        label: 'From',
        value: `${transfer.fromAccount.code} — ${transfer.fromAccount.name}`,
      },
      { label: 'To', value: `${transfer.toAccount.code} — ${transfer.toAccount.name}` },
      { label: 'Amount', value: moneyLabel(transfer.amount, currency) },
      ...(transfer.reference ? [{ label: 'Reference', value: transfer.reference }] : []),
      ...(transfer.memo ? [{ label: 'Memo', value: transfer.memo }] : []),
    ]
  }

  if (entity === 'Deposit') {
    const deposit = await db.deposit.findFirst({
      where: withDeleted,
      select: {
        number: true,
        date: true,
        total: true,
        currencyCode: true,
        memo: true,
        reference: true,
        bankAccount: { select: { code: true, name: true } },
      },
    })
    if (!deposit) return []
    const currency = deposit.currencyCode || currencyFallback
    return [
      { label: 'Number', value: deposit.number },
      { label: 'Date', value: toCalendarDate(deposit.date) },
      {
        label: 'Bank account',
        value: `${deposit.bankAccount.code} — ${deposit.bankAccount.name}`,
      },
      { label: 'Total', value: moneyLabel(deposit.total, currency) },
      ...(deposit.reference ? [{ label: 'Reference', value: deposit.reference }] : []),
      ...(deposit.memo ? [{ label: 'Memo', value: deposit.memo }] : []),
    ]
  }

  if (entity === 'InventoryAdjustment') {
    const adjustment = await db.inventoryAdjustment.findFirst({
      where: withDeleted,
      select: {
        number: true,
        date: true,
        memo: true,
        reason: true,
      },
    })
    if (!adjustment) return []
    return [
      { label: 'Number', value: adjustment.number },
      { label: 'Date', value: toCalendarDate(adjustment.date) },
      ...(adjustment.reason ? [{ label: 'Adjustment reason', value: adjustment.reason }] : []),
      ...(adjustment.memo ? [{ label: 'Memo', value: adjustment.memo }] : []),
    ]
  }

  if (entity === 'Item') {
    const item = await db.item.findFirst({
      where: withDeleted,
      select: { name: true, sku: true, description: true },
    })
    if (!item) return []
    return [
      { label: 'Name', value: item.name },
      ...(item.sku ? [{ label: 'SKU', value: item.sku }] : []),
      ...(item.description ? [{ label: 'Description', value: item.description }] : []),
    ]
  }

  return []
}

/** One trash line with its papers — for the detail screen. */
export async function get(ctx: OrgContext, id: string) {
  const row = await loadDeleteLog(ctx, id)
  const entry = presentTrashEntry(row)
  const files = await listTrashFiles(ctx, id)
  if (isCleared(row.after)) throw notFound('Trash entry')

  const reason = entry.reason ?? (await rowDeleteReason(ctx, row.entity, row.entityId))
  const restored = isRestored(row.after)
  const before = afterRecord(row.before) ?? {}
  const fromRow = await formSnapshot(ctx, row.entity, row.entityId)
  const snapshot = fromRow.length > 0 ? fromRow : auditBeforeSnapshot(before)

  return {
    ...entry,
    reason,
    entity: row.entity,
    entityId: row.entityId,
    origin: trashOrigin(row.entity, row.before),
    snapshot,
    restored,
    canRestore: !restored && trashRestoreCapability(row.entity).canRestore,
    cannotRestoreReason: restored
      ? null
      : trashRestoreCapability(row.entity).cannotRestoreReason,
    files: files.map((file) => ({
      ...file,
      createdAt: file.createdAt.toISOString(),
    })),
  }
}

/**
 * Put a deleted transaction back into the working books from its Trash line.
 *
 * Marks the DELETE audit row so the entry leaves the Trash list, and writes a
 * RESTORE audit on the live record.
 */
export async function restore(
  ctx: OrgContext,
  id: string,
): Promise<{ id: string; number: string; href: string }> {
  const row = await loadDeleteLog(ctx, id)
  if (isCleared(row.after)) {
    throw precondition('This record was cleared from Trash and can no longer be restored.')
  }
  if (isRestored(row.after)) {
    throw precondition('This record was already restored.')
  }
  if (row.entity === 'Deposit') {
    throw precondition(
      'A deleted deposit cannot be restored — the payments it banked were released and are no longer linked. Enter a new deposit from undeposited funds instead.',
    )
  }
  if (!TRASH_RESTORABLE.has(row.entity)) {
    throw precondition('This kind of record cannot be restored from Trash.')
  }

  let result: { id: string; number: string; href: string }

  switch (row.entity) {
    case 'Journal':
      result = await journalService.restore(ctx, row.entityId)
      break
    case 'SalesDocument':
      result = await salesService.restore(ctx, row.entityId)
      break
    case 'PurchaseDocument':
      result = await purchaseService.restore(ctx, row.entityId)
      break
    case 'CustomerPayment':
      result = await paymentService.restore(ctx, row.entityId)
      break
    case 'BillPayment':
      result = await billPaymentService.restore(ctx, row.entityId)
      break
    case 'BankTransfer':
      result = await bankingService.restoreTransfer(ctx, row.entityId)
      break
    case 'InventoryAdjustment':
      result = await inventoryService.restoreAdjustment(ctx, row.entityId)
      break
    case 'AssemblyBuild':
      result = await assemblyBuildService.restore(ctx, row.entityId)
      break
    default:
      throw precondition('This kind of record cannot be restored from Trash.')
  }

  const previous = afterRecord(row.after) ?? {}
  await db.auditLog.update({
    where: { id: row.id },
    data: {
      after: {
        ...previous,
        restored: true,
        restoredAt: new Date().toISOString(),
        restoredById: ctx.userId,
        restoredTo: result.href,
      },
    },
  })

  return result
}

async function markCleared(
  ctx: OrgContext,
  rows: { id: string; after: unknown }[],
): Promise<number> {
  if (rows.length === 0) return 0

  await removeTrashFilesForLogs(
    ctx,
    rows.map((row) => row.id),
  )

  const clearedAt = new Date().toISOString()
  for (const row of rows) {
    const previous = afterRecord(row.after) ?? {}
    await db.auditLog.update({
      where: { id: row.id },
      data: {
        after: {
          ...previous,
          cleared: true,
          clearedAt,
          clearedById: ctx.userId,
        },
      },
    })
  }

  return rows.length
}

/**
 * Remove one Trash line and permanently delete its soft-deleted books row
 * from PostgreSQL. Soft-delete → Trash still works; Clear is the hard purge.
 */
export async function clearOne(ctx: OrgContext, id: string): Promise<{ count: number }> {
  const row = await loadDeleteLog(ctx, id)
  if (isGoneFromTrash(row.after)) {
    throw precondition('That trash entry is already gone.')
  }

  await db.$transaction(
    async (tx) => {
      await purgeDeletedEntity(tx, ctx, row.entity, row.entityId)
    },
    { timeout: 60_000 },
  )

  const count = await markCleared(ctx, [{ id: row.id, after: row.after }])
  return { count }
}

/**
 * Empty Trash for this company and permanently remove soft-deleted books rows
 * from PostgreSQL. Soft-delete → Trash still works; Clear is the hard purge.
 */
export async function clearAll(ctx: OrgContext): Promise<{ count: number }> {
  const rows = await db.auditLog.findMany({
    where: { orgId: ctx.orgId, action: 'DELETE' },
    select: { id: true, entity: true, entityId: true, after: true },
  })
  const active = rows
    .filter((row) => !isGoneFromTrash(row.after))
    .sort((a, b) => trashPurgeOrder(a.entity) - trashPurgeOrder(b.entity))

  let count = 0
  for (const row of active) {
    await db.$transaction(
      async (tx) => {
        await purgeDeletedEntity(tx, ctx, row.entity, row.entityId)
      },
      { timeout: 60_000 },
    )
    count += await markCleared(ctx, [{ id: row.id, after: row.after }])
  }
  return { count }
}

function filenameFor(kind: string, name: string | null) {
  const base = [kind, name].filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `${base || 'deleted-record'}.pdf`
}

/**
 * Rebuild the paper for a deleted record, or a short trash sheet when the
 * original form cannot be drawn. Never opens a working-books page.
 */
export async function renderPdf(
  ctx: OrgContext,
  id: string,
  options?: { ink?: PrintInk },
): Promise<{ bytes: Uint8Array; filename: string }> {
  const ink = options?.ink ?? 'color'
  const row = await loadDeleteLog(ctx, id)
  const entry = presentTrashEntry(row)
  const [org, template] = await Promise.all([
    organizationService.get(ctx),
    organizationService.getDocumentTemplate(ctx),
  ])
  const company = letterheadOf(org)
  const letterhead = {
    orgName: company.name,
    orgAddress: company.address ? [company.address] : [],
    orgPhone: company.phone,
    orgEmail: company.email,
  }

  if (row.entity === 'SalesDocument') {
    const document = await db.salesDocument.findFirst({
      where: { id: row.entityId, orgId: ctx.orgId, deletedAt: undefined },
      select: {
        type: true,
        number: true,
        date: true,
        createdAt: true,
        dueDate: true,
        reference: true,
        currencyCode: true,
        subtotal: true,
        discountAmount: true,
        taxTotal: true,
        total: true,
        customerMessage: true,
        paymentTerm: { select: { name: true } },
        customer: {
          select: {
            displayName: true,
            email: true,
            phone: true,
            billingLine1: true,
            billingLine2: true,
            billingCity: true,
            billingRegion: true,
          },
        },
        lines: {
          orderBy: { lineNumber: 'asc' },
          select: {
            quantity: true,
            description: true,
            unitPrice: true,
            amount: true,
            item: { select: { sku: true, name: true, unitOfMeasure: true } },
          },
        },
      },
    })
    if (document) {
      const config = salesByType(document.type)
      const currency = document.currencyCode || ctx.organization.baseCurrency
      const bytes = renderSalesDocumentPdf({
        ink,
        template,
        ...letterhead,
        title: config.singular,
        number: document.number,
        date: document.date,
        createdAt: document.createdAt,
        timeZone: org.timeZone,
        dueDate: document.dueDate,
        customerName: document.customer.displayName,
        customerAddress: [
          document.customer.billingLine1,
          document.customer.billingLine2,
          document.customer.billingCity,
          document.customer.billingRegion,
        ].filter((part): part is string => Boolean(part)),
        customerEmail: document.customer.email,
        customerPhone: document.customer.phone,
        reference: document.reference,
        paymentTerm: document.paymentTerm?.name ?? null,
        status: 'DELETED',
        currency,
        lines: document.lines.map((line) => ({
          quantity: line.quantity.toString(),
          sku: line.item?.sku ?? null,
          description: line.description ?? line.item?.name ?? 'Line',
          unitPrice: line.unitPrice.toString(),
          amount: line.amount.toString(),
          unitOfMeasure: line.item?.unitOfMeasure ?? null,
        })),
        subtotal: document.subtotal.toString(),
        discountAmount: document.discountAmount.toString(),
        taxTotal: document.taxTotal.toString(),
        total: document.total.toString(),
        message: document.customerMessage,
      })
      return { bytes, filename: filenameFor(config.singular, document.number) }
    }
  }

  if (row.entity === 'PurchaseDocument') {
    const document = await db.purchaseDocument.findFirst({
      where: { id: row.entityId, orgId: ctx.orgId, deletedAt: undefined },
      select: {
        type: true,
        number: true,
        date: true,
        createdAt: true,
        dueDate: true,
        reference: true,
        currencyCode: true,
        subtotal: true,
        taxTotal: true,
        total: true,
        memo: true,
        vendor: {
          select: { displayName: true, email: true, phone: true },
        },
        lines: {
          orderBy: { lineNumber: 'asc' },
          select: {
            quantity: true,
            description: true,
            unitPrice: true,
            amount: true,
            item: { select: { sku: true, name: true, unitOfMeasure: true } },
          },
        },
      },
    })
    if (document) {
      const config = purchaseByType(document.type)
      const currency = document.currencyCode || ctx.organization.baseCurrency
      const bytes = renderSalesDocumentPdf({
        ink,
        template,
        partyLabel: 'Vendor',
        ...letterhead,
        title: config.singular,
        number: document.number,
        date: document.date,
        createdAt: document.createdAt,
        timeZone: org.timeZone,
        dueDate: document.dueDate,
        customerName: document.vendor.displayName,
        customerAddress: [],
        customerEmail: document.vendor.email,
        customerPhone: document.vendor.phone,
        reference: document.reference,
        status: 'DELETED',
        currency,
        lines: document.lines.map((line) => ({
          quantity: line.quantity.toString(),
          sku: line.item?.sku ?? null,
          description: line.description ?? line.item?.name ?? 'Line',
          unitPrice: line.unitPrice.toString(),
          amount: line.amount.toString(),
          unitOfMeasure: line.item?.unitOfMeasure ?? null,
        })),
        subtotal: document.subtotal.toString(),
        discountAmount: '0',
        taxTotal: document.taxTotal.toString(),
        total: document.total.toString(),
        message: document.memo,
      })
      return { bytes, filename: filenameFor(config.singular, document.number) }
    }
  }

  if (row.entity === 'Journal') {
    const journal = await db.journal.findFirst({
      where: { id: row.entityId, orgId: ctx.orgId, status: 'DELETED' },
      select: {
        journalNumber: true,
        date: true,
        memo: true,
        deleteReason: true,
        lines: {
          orderBy: { lineNumber: 'asc' },
          select: {
            debit: true,
            credit: true,
            description: true,
            account: { select: { code: true, name: true } },
          },
        },
      },
    })
    if (journal) {
      const fields = [
        { label: 'Date', value: toCalendarDate(journal.date) },
        ...(journal.memo ? [{ label: 'Memo', value: journal.memo }] : []),
        ...journal.lines.map((line) => ({
          label: `${line.account.code} ${line.account.name}`,
          value: `Dr ${line.debit.toString()} / Cr ${line.credit.toString()}${
            line.description ? ` — ${line.description}` : ''
          }`,
        })),
      ]
      const bytes = renderTrashRecordPdf({
        ink,
        template,
        ...letterhead,
        kind: entry.kind,
        name: journal.journalNumber,
        who: entry.who,
        at: entry.at,
        timeZone: org.timeZone,
        reason: entry.reason ?? journal.deleteReason,
        fields,
      })
      return { bytes, filename: filenameFor('Journal', journal.journalNumber) }
    }
  }

  if (row.entity === 'CustomerPayment') {
    const payment = await db.customerPayment.findFirst({
      where: { id: row.entityId, orgId: ctx.orgId, deletedAt: undefined },
      select: {
        number: true,
        date: true,
        amount: true,
        currencyCode: true,
        memo: true,
        customer: { select: { displayName: true } },
      },
    })
    if (payment) {
      const bytes = renderTrashRecordPdf({
        ink,
        template,
        ...letterhead,
        kind: entry.kind,
        name: payment.number,
        who: entry.who,
        at: entry.at,
        timeZone: org.timeZone,
        reason: entry.reason,
        fields: [
          { label: 'Customer', value: payment.customer.displayName },
          { label: 'Date', value: toCalendarDate(payment.date) },
          { label: 'Amount', value: `${payment.amount.toString()} ${payment.currencyCode}` },
          ...(payment.memo ? [{ label: 'Memo', value: payment.memo }] : []),
        ],
      })
      return { bytes, filename: filenameFor('Payment', payment.number) }
    }
  }

  if (row.entity === 'BillPayment') {
    const payment = await db.billPayment.findFirst({
      where: { id: row.entityId, orgId: ctx.orgId, deletedAt: undefined },
      select: {
        number: true,
        date: true,
        amount: true,
        currencyCode: true,
        memo: true,
        vendor: { select: { displayName: true } },
      },
    })
    if (payment) {
      const bytes = renderTrashRecordPdf({
        ink,
        template,
        ...letterhead,
        kind: entry.kind,
        name: payment.number,
        who: entry.who,
        at: entry.at,
        timeZone: org.timeZone,
        reason: entry.reason,
        fields: [
          { label: 'Vendor', value: payment.vendor.displayName },
          { label: 'Date', value: toCalendarDate(payment.date) },
          { label: 'Amount', value: `${payment.amount.toString()} ${payment.currencyCode}` },
          ...(payment.memo ? [{ label: 'Memo', value: payment.memo }] : []),
        ],
      })
      return { bytes, filename: filenameFor('Bill-payment', payment.number) }
    }
  }

  if (row.entity === 'BankTransfer') {
    const transfer = await db.bankTransfer.findFirst({
      where: { id: row.entityId, orgId: ctx.orgId, deletedAt: undefined },
      select: {
        number: true,
        date: true,
        amount: true,
        currencyCode: true,
        memo: true,
        reference: true,
        fromAccount: { select: { code: true, name: true } },
        toAccount: { select: { code: true, name: true } },
      },
    })
    if (transfer) {
      const bytes = renderTrashRecordPdf({
        ink,
        template,
        ...letterhead,
        kind: 'Transfer',
        name: transfer.number,
        who: entry.who,
        at: entry.at,
        timeZone: org.timeZone,
        reason: entry.reason,
        fields: [
          { label: 'Date', value: toCalendarDate(transfer.date) },
          {
            label: 'From',
            value: `${transfer.fromAccount.code} — ${transfer.fromAccount.name}`,
          },
          { label: 'To', value: `${transfer.toAccount.code} — ${transfer.toAccount.name}` },
          { label: 'Amount', value: `${transfer.amount.toString()} ${transfer.currencyCode}` },
          ...(transfer.reference ? [{ label: 'Reference', value: transfer.reference }] : []),
          ...(transfer.memo ? [{ label: 'Memo', value: transfer.memo }] : []),
        ],
      })
      return { bytes, filename: filenameFor('Transfer', transfer.number) }
    }
  }

  if (row.entity === 'Deposit') {
    const deposit = await db.deposit.findFirst({
      where: { id: row.entityId, orgId: ctx.orgId, deletedAt: undefined },
      select: {
        number: true,
        date: true,
        total: true,
        currencyCode: true,
        memo: true,
        reference: true,
        bankAccount: { select: { code: true, name: true } },
      },
    })
    if (deposit) {
      const bytes = renderTrashRecordPdf({
        ink,
        template,
        ...letterhead,
        kind: 'Deposit',
        name: deposit.number,
        who: entry.who,
        at: entry.at,
        timeZone: org.timeZone,
        reason: entry.reason,
        fields: [
          { label: 'Date', value: toCalendarDate(deposit.date) },
          {
            label: 'Bank account',
            value: `${deposit.bankAccount.code} — ${deposit.bankAccount.name}`,
          },
          { label: 'Total', value: `${deposit.total.toString()} ${deposit.currencyCode}` },
          ...(deposit.reference ? [{ label: 'Reference', value: deposit.reference }] : []),
          ...(deposit.memo ? [{ label: 'Memo', value: deposit.memo }] : []),
        ],
      })
      return { bytes, filename: filenameFor('Deposit', deposit.number) }
    }
  }

  if (row.entity === 'InventoryAdjustment') {
    const adjustment = await db.inventoryAdjustment.findFirst({
      where: { id: row.entityId, orgId: ctx.orgId, deletedAt: undefined },
      select: {
        number: true,
        date: true,
        memo: true,
        reason: true,
        account: { select: { code: true, name: true } },
        lines: {
          orderBy: { lineNumber: 'asc' },
          select: {
            quantityChange: true,
            value: true,
            item: { select: { name: true, sku: true } },
          },
        },
      },
    })
    if (adjustment) {
      const bytes = renderTrashRecordPdf({
        ink,
        template,
        ...letterhead,
        kind: 'Stock adjustment',
        name: adjustment.number,
        who: entry.who,
        at: entry.at,
        timeZone: org.timeZone,
        reason: entry.reason ?? adjustment.reason,
        fields: [
          { label: 'Date', value: toCalendarDate(adjustment.date) },
          {
            label: 'Account',
            value: `${adjustment.account.code} — ${adjustment.account.name}`,
          },
          ...(adjustment.memo ? [{ label: 'Memo', value: adjustment.memo }] : []),
          ...adjustment.lines.map((line) => ({
            label: line.item.sku ? `${line.item.name} (${line.item.sku})` : line.item.name,
            value: `Qty ${line.quantityChange.toString()} · value ${line.value.toString()}`,
          })),
        ],
      })
      return { bytes, filename: filenameFor('Stock-adjustment', adjustment.number) }
    }
  }

  const before = recordOf(row.before)
  const fields: { label: string; value: string }[] = []
  if (before) {
    for (const [key, value] of Object.entries(before)) {
      if (key === 'entries' && Array.isArray(value)) {
        const joined = value.map(text).filter((part): part is string => Boolean(part)).join(', ')
        if (joined) fields.push({ label: 'Entries', value: joined })
        continue
      }
      const shown = text(value) ?? (typeof value === 'number' || typeof value === 'boolean' ? String(value) : null)
      if (!shown) continue
      if (/^c[a-z0-9]{20,}$/i.test(shown)) continue
      fields.push({
        label: key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()),
        value: shown,
      })
    }
  }

  const bytes = renderTrashRecordPdf({
    ink,
    template,
    ...letterhead,
    kind: entry.kind,
    name: entry.name,
    who: entry.who,
    at: entry.at,
    timeZone: org.timeZone,
    reason: entry.reason,
    fields,
  })
  return { bytes, filename: filenameFor(entry.kind, entry.name) }
}
