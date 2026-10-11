import 'server-only'

import { purchaseByType } from '@/lib/purchase-types'
import { byType as salesByType } from '@/lib/sales-types'
import { letterheadOf } from '@/lib/letterhead'
import { presentTrashEntry } from '@/lib/trash-log'
import { toCalendarDate } from '@/lib/date'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound } from '@/server/errors'
import { listTrashFiles } from '@/server/files/trash-files'
import { renderSalesDocumentPdf } from '@/server/reports/sales-document-pdf'
import { renderTrashRecordPdf } from '@/server/reports/trash-record-pdf'
import * as organizationService from '@/server/services/organization.service'

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

/** One trash line with its papers — for the detail screen. */
export async function get(ctx: OrgContext, id: string) {
  const row = await loadDeleteLog(ctx, id)
  const entry = presentTrashEntry(row)
  const files = await listTrashFiles(ctx, id)
  return {
    ...entry,
    entity: row.entity,
    files: files.map((file) => ({
      ...file,
      createdAt: file.createdAt.toISOString(),
    })),
  }
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
): Promise<{ bytes: Uint8Array; filename: string }> {
  const row = await loadDeleteLog(ctx, id)
  const entry = presentTrashEntry(row)
  const org = await organizationService.get(ctx)
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
        currencyCode: true,
        subtotal: true,
        discountAmount: true,
        taxTotal: true,
        total: true,
        customerMessage: true,
        customer: {
          select: {
            displayName: true,
            email: true,
            billingLine1: true,
            billingCity: true,
          },
        },
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
    if (document) {
      const config = salesByType(document.type)
      const currency = document.currencyCode || ctx.organization.baseCurrency
      const bytes = renderSalesDocumentPdf({
        ...letterhead,
        title: `${config.singular} (deleted)`,
        number: document.number,
        date: document.date,
        createdAt: document.createdAt,
        timeZone: org.timeZone,
        dueDate: document.dueDate,
        customerName: document.customer.displayName,
        customerAddress: [document.customer.billingLine1, document.customer.billingCity].filter(
          (part): part is string => Boolean(part),
        ),
        customerEmail: document.customer.email,
        currency,
        lines: document.lines.map((line) => ({
          quantity: line.quantity.toString(),
          sku: line.item?.sku ?? null,
          description: line.description ?? line.item?.name ?? 'Line',
          unitPrice: line.unitPrice.toString(),
          amount: line.amount.toString(),
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
            item: { select: { sku: true, name: true } },
          },
        },
      },
    })
    if (document) {
      const config = purchaseByType(document.type)
      const currency = document.currencyCode || ctx.organization.baseCurrency
      const bytes = renderSalesDocumentPdf({
        ...letterhead,
        title: `${config.singular} (deleted)`,
        number: document.number,
        date: document.date,
        createdAt: document.createdAt,
        timeZone: org.timeZone,
        dueDate: document.dueDate,
        customerName: document.vendor.displayName,
        customerAddress: [],
        customerEmail: document.vendor.email,
        currency,
        lines: document.lines.map((line) => ({
          quantity: line.quantity.toString(),
          sku: line.item?.sku ?? null,
          description: line.description ?? line.item?.name ?? 'Line',
          unitPrice: line.unitPrice.toString(),
          amount: line.amount.toString(),
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
