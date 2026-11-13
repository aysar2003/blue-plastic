import { NextResponse } from 'next/server'

import type { JournalSourceType } from '@prisma/client'

import { JOURNAL_SOURCE_LABELS } from '@/lib/accounting-labels'
import { toCalendarDate, today } from '@/lib/date'
import { presetRange, readDatePreset } from '@/lib/list-filters'
import { parsePackIds, sortPackDocuments } from '@/lib/document-pack'
import { bySlug } from '@/lib/sales-types'
import { purchaseBySlug } from '@/lib/purchase-types'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import type { CsvCell } from '@/server/reports/csv'
import {
  renderListXlsx,
  xlsxResponse,
  type ListXlsxColumn,
} from '@/server/reports/list-xlsx'
import * as accountService from '@/server/services/account.service'
import * as billPaymentService from '@/server/services/bill-payment.service'
import * as contactService from '@/server/services/contact.service'
import * as itemService from '@/server/services/item.service'
import * as journalService from '@/server/services/journal.service'
import * as paymentService from '@/server/services/payment.service'
import * as purchaseService from '@/server/services/purchase.service'
import * as salesService from '@/server/services/sales.service'

export const dynamic = 'force-dynamic'

/**
 * A list, as an Excel workbook.
 *
 * Exports every row the filter matches (not just the on-screen page). The file
 * carries the company letterhead, a clear title, and a formatted table so phones
 * stay text and amounts stay numbers when opened in Excel.
 */
const ALL = { page: 1, pageSize: 5000, dir: 'asc' as const }

async function workbook(
  ctx: Awaited<ReturnType<typeof requireOrgContext>>,
  title: string,
  filename: string,
  columns: ListXlsxColumn[],
  bodyRows: CsvCell[][],
) {
  const bytes = await renderListXlsx({
    org: ctx.organization,
    title,
    currency: ctx.organization.baseCurrency,
    exportedAt: today(ctx.organization.timeZone),
    sheetName: title,
    columns,
    rows: bodyRows,
  })
  return xlsxResponse(filename, bytes)
}

export async function GET(request: Request, { params }: { params: Promise<{ list: string }> }) {
  try {
    const { list } = await params
    const url = new URL(request.url)
    const q = url.searchParams.get('q') ?? undefined
    const status = url.searchParams.get('status') ?? undefined
    const customerId = url.searchParams.get('customer') ?? undefined
    const type = url.searchParams.get('type') ?? undefined
    const archived = url.searchParams.get('archived') === '1'
    const sort = url.searchParams.get('sort') ?? undefined
    const dir = url.searchParams.get('dir') === 'desc' ? ('desc' as const) : ('asc' as const)

    const ctx = await requireOrgContext('report:read')
    const datePreset = readDatePreset(url.searchParams.get('date') ?? undefined)
    const range = presetRange(datePreset, today(ctx.organization.timeZone))
    const sourceRaw = url.searchParams.get('source') ?? undefined
    const sourceType =
      sourceRaw && sourceRaw in JOURNAL_SOURCE_LABELS ? (sourceRaw as JournalSourceType) : undefined
    const span = { from: range?.from, to: range?.to }

    // --- Sales and purchase documents, keyed by their URL slug ---------------
    const ids = parsePackIds(url.searchParams.get('ids'))
    const picked = ids.length > 0
    const salesConfig = bySlug(list)
    if (salesConfig) {
      const page = await salesService.list(ctx, salesConfig.type, { ...ALL, q: picked ? undefined : q }, {
        status: picked ? undefined : status,
        customerId: picked ? undefined : customerId,
        ids,
        sort: picked ? 'date' : sort,
        dir: picked ? 'asc' : dir,
        ...(picked ? {} : span),
      })
      const listed = picked ? sortPackDocuments(page.rows) : page.rows
      const columns: ListXlsxColumn[] = [
        { header: 'Number', width: 14, kind: 'text' },
        { header: 'Date', width: 12, kind: 'date' },
        { header: 'Due', width: 12, kind: 'date' },
        { header: 'Customer', width: 28, kind: 'text' },
        { header: 'Reference', width: 16, kind: 'text' },
        { header: 'Status', width: 12, kind: 'text' },
        { header: 'Total', width: 14, kind: 'money' },
        { header: 'Outstanding', width: 14, kind: 'money' },
        { header: 'Deposit to', width: 22, kind: 'text' },
      ]
      const body: CsvCell[][] = listed.map((row) => {
        const account = row.depositAccount
        return [
          row.number,
          toCalendarDate(row.date),
          row.dueDate ? toCalendarDate(row.dueDate) : '',
          row.customer.displayName,
          row.reference ?? '',
          row.status,
          row.total,
          row.balance,
          account ? `${account.code} ${account.name}` : '',
        ]
      })
      return workbook(ctx, salesConfig.plural, `${salesConfig.slug}.xlsx`, columns, body)
    }

    const purchaseConfig = purchaseBySlug(list)
    if (purchaseConfig) {
      const vendorId = url.searchParams.get('vendorId') ?? undefined
      const page = await purchaseService.list(ctx, purchaseConfig.type, { ...ALL, q: picked ? undefined : q }, {
        status: picked ? undefined : status,
        vendorId: picked ? undefined : vendorId,
        ids,
        sort: picked ? 'date' : sort,
        dir: picked ? 'asc' : dir,
        ...(picked ? {} : span),
      })
      const listed = picked ? sortPackDocuments(page.rows) : page.rows
      const columns: ListXlsxColumn[] = [
        { header: 'Number', width: 14, kind: 'text' },
        { header: 'Date', width: 12, kind: 'date' },
        { header: 'Due', width: 12, kind: 'date' },
        { header: 'Vendor', width: 28, kind: 'text' },
        { header: 'Their reference', width: 16, kind: 'text' },
        { header: 'Status', width: 12, kind: 'text' },
        { header: 'Total', width: 14, kind: 'money' },
        { header: 'Owing', width: 14, kind: 'money' },
      ]
      const body: CsvCell[][] = listed.map((row) => [
        row.number,
        toCalendarDate(row.date),
        row.dueDate ? toCalendarDate(row.dueDate) : '',
        row.vendor?.displayName ?? '—',
        row.reference ?? '',
        row.status,
        row.total,
        row.balance,
      ])
      return workbook(ctx, purchaseConfig.plural, `${purchaseConfig.slug}.xlsx`, columns, body)
    }

    switch (list) {
      case 'journals': {
        const page = await journalService.list(ctx, { ...ALL, q }, { sort, dir, sourceType, ...span })
        const columns: ListXlsxColumn[] = [
          { header: 'Entry', width: 12, kind: 'text' },
          { header: 'Date', width: 12, kind: 'date' },
          { header: 'Description', width: 36, kind: 'text' },
          { header: 'Source', width: 16, kind: 'text' },
          { header: 'Document', width: 14, kind: 'text' },
          { header: 'Customer / vendor', width: 24, kind: 'text' },
          { header: 'Status', width: 12, kind: 'text' },
          { header: 'Amount', width: 14, kind: 'money' },
        ]
        const body: CsvCell[][] = page.rows.map((row) => [
          row.journalNumber,
          toCalendarDate(row.date),
          row.memo ?? '',
          row.sourceType,
          row.source.number ?? '',
          row.source.partyName ?? '',
          row.status,
          row.total,
        ])
        return workbook(ctx, 'Journal entries', 'journal-entries.xlsx', columns, body)
      }

      case 'payments': {
        const page = await paymentService.list(ctx, { ...ALL, q }, { sort, dir, ...span })
        const columns: ListXlsxColumn[] = [
          { header: 'Number', width: 14, kind: 'text' },
          { header: 'Date', width: 12, kind: 'date' },
          { header: 'Customer', width: 28, kind: 'text' },
          { header: 'Method', width: 14, kind: 'text' },
          { header: 'Status', width: 12, kind: 'text' },
          { header: 'Amount', width: 14, kind: 'money' },
          { header: 'Unapplied', width: 14, kind: 'money' },
        ]
        const body: CsvCell[][] = page.rows.map((row) => [
          row.number,
          toCalendarDate(row.date),
          row.customer.displayName,
          row.method,
          row.status,
          row.amount,
          row.unapplied,
        ])
        return workbook(ctx, 'Customer payments', 'customer-payments.xlsx', columns, body)
      }

      case 'bill-payments': {
        const page = await billPaymentService.list(ctx, { ...ALL, q }, { sort, dir, ...span })
        const columns: ListXlsxColumn[] = [
          { header: 'Number', width: 14, kind: 'text' },
          { header: 'Date', width: 12, kind: 'date' },
          { header: 'Vendor', width: 28, kind: 'text' },
          { header: 'Method', width: 14, kind: 'text' },
          { header: 'Status', width: 12, kind: 'text' },
          { header: 'Amount', width: 14, kind: 'money' },
        ]
        const body: CsvCell[][] = page.rows.map((row) => [
          row.number,
          toCalendarDate(row.date),
          row.vendor?.displayName ?? '—',
          row.method,
          row.status,
          row.amount,
        ])
        return workbook(ctx, 'Bill payments', 'bill-payments.xlsx', columns, body)
      }

      case 'customers':
      case 'vendors': {
        const everything = { ...ALL, pageSize: 20000, q }
        const asOf = today(ctx.organization.timeZone)
        if (list === 'customers') {
          const page = await contactService.listCustomers(ctx, everything, {
            includeInactive: archived,
            sort,
            dir,
          })
          const columns: ListXlsxColumn[] = [
            { header: 'Display name', width: 28, kind: 'text' },
            { header: 'Company name', width: 28, kind: 'text' },
            { header: 'First name', width: 14, kind: 'text' },
            { header: 'Last name', width: 14, kind: 'text' },
            { header: 'Email', width: 28, kind: 'text' },
            { header: 'Phone', width: 16, kind: 'text' },
            { header: 'Mobile', width: 16, kind: 'text' },
            { header: 'Street', width: 28, kind: 'text' },
            { header: 'City', width: 16, kind: 'text' },
            { header: 'State', width: 14, kind: 'text' },
            { header: 'Postal code', width: 12, kind: 'text' },
            { header: 'Country', width: 10, kind: 'text' },
            { header: 'Payment terms', width: 16, kind: 'text' },
            { header: 'Tax registration', width: 16, kind: 'text' },
            { header: 'Credit limit', width: 12, kind: 'money' },
            { header: 'Open balance', width: 14, kind: 'money' },
            { header: 'Opening balance date', width: 14, kind: 'date' },
            { header: 'Notes', width: 28, kind: 'text' },
            { header: 'Active', width: 10, kind: 'text' },
          ]
          const body: CsvCell[][] = page.rows.map((row) => {
            const balance = Number(row.balance) === 0 ? '' : row.balance
            return [
              row.displayName,
              row.companyName ?? '',
              row.firstName ?? '',
              row.lastName ?? '',
              row.email ?? '',
              row.phone ?? '',
              row.mobile ?? '',
              row.billingLine1 ?? '',
              row.billingCity ?? '',
              row.billingRegion ?? '',
              row.billingPostalCode ?? '',
              row.billingCountry ?? '',
              row.paymentTerm?.name ?? '',
              row.taxRegistrationNumber ?? '',
              row.creditLimit ?? '',
              balance,
              balance ? asOf : '',
              row.notes ?? '',
              row.isActive ? 'Yes' : 'No',
            ]
          })
          return workbook(ctx, 'Customers', 'customers.xlsx', columns, body)
        }

        const owing =
          url.searchParams.get('balance') === 'open' ? await contactService.vendorIdsWithBalance(ctx) : undefined
        const page = await contactService.listVendors(ctx, everything, {
          includeInactive: archived,
          sort,
          dir,
          ids: owing,
        })
        const columns: ListXlsxColumn[] = [
          { header: 'Display name', width: 28, kind: 'text' },
          { header: 'Company name', width: 28, kind: 'text' },
          { header: 'First name', width: 14, kind: 'text' },
          { header: 'Last name', width: 14, kind: 'text' },
          { header: 'Email', width: 28, kind: 'text' },
          { header: 'Phone', width: 16, kind: 'text' },
          { header: 'Mobile', width: 16, kind: 'text' },
          { header: 'Street', width: 28, kind: 'text' },
          { header: 'City', width: 16, kind: 'text' },
          { header: 'State', width: 14, kind: 'text' },
          { header: 'Postal code', width: 12, kind: 'text' },
          { header: 'Country', width: 10, kind: 'text' },
          { header: 'Payment terms', width: 16, kind: 'text' },
          { header: 'Tax registration', width: 16, kind: 'text' },
          { header: 'Open balance', width: 14, kind: 'money' },
          { header: 'Opening balance date', width: 14, kind: 'date' },
          { header: 'Notes', width: 28, kind: 'text' },
          { header: 'Active', width: 10, kind: 'text' },
        ]
        const body: CsvCell[][] = page.rows.map((row) => {
          const balance = Number(row.balance) === 0 ? '' : row.balance
          return [
            row.displayName,
            row.companyName ?? '',
            row.firstName ?? '',
            row.lastName ?? '',
            row.email ?? '',
            row.phone ?? '',
            row.mobile ?? '',
            row.billingLine1 ?? '',
            row.billingCity ?? '',
            row.billingRegion ?? '',
            row.billingPostalCode ?? '',
            row.billingCountry ?? '',
            row.paymentTerm?.name ?? '',
            row.taxRegistrationNumber ?? '',
            balance,
            balance ? asOf : '',
            row.notes ?? '',
            row.isActive ? 'Yes' : 'No',
          ]
        })
        return workbook(ctx, 'Vendors', 'vendors.xlsx', columns, body)
      }

      case 'items': {
        const page = await itemService.list(
          ctx,
          { ...ALL, pageSize: 20000, q },
          { includeInactive: archived, type, sort, dir },
        )
        const asOf = today(ctx.organization.timeZone)
        const typeLabel = (value: string) =>
          value === 'SERVICE' ? 'Service' : value === 'INVENTORY' ? 'Inventory' : 'Non-inventory'
        const columns: ListXlsxColumn[] = [
          { header: 'Product/Service Name', width: 28, kind: 'text' },
          { header: 'SKU', width: 14, kind: 'text' },
          { header: 'Type', width: 14, kind: 'text' },
          { header: 'Sales Description', width: 32, kind: 'text' },
          { header: 'Sales Price', width: 12, kind: 'money' },
          { header: 'Taxable', width: 10, kind: 'text' },
          { header: 'Income Account', width: 22, kind: 'text' },
          { header: 'Purchase Description', width: 28, kind: 'text' },
          { header: 'Purchase Cost', width: 12, kind: 'money' },
          { header: 'Expense Account', width: 22, kind: 'text' },
          { header: 'Quantity on hand', width: 12, kind: 'number' },
          { header: 'Reorder Point', width: 12, kind: 'number' },
          { header: 'Inventory Asset Account', width: 22, kind: 'text' },
          { header: 'Quantity as-of date', width: 14, kind: 'date' },
          { header: 'Active', width: 10, kind: 'text' },
        ]
        const body: CsvCell[][] = page.rows.map((row) => {
          const onHand = row.onHand && Number(row.onHand) !== 0 ? row.onHand : ''
          return [
            row.name,
            row.sku ?? '',
            typeLabel(row.type),
            row.salesDescription ?? row.description ?? '',
            row.salesPrice ?? '',
            row.isTaxable ? 'Yes' : 'No',
            row.incomeAccount?.name ?? '',
            row.purchaseDescription ?? '',
            row.purchaseCost ?? '',
            (row.type === 'INVENTORY' ? row.cogsAccount?.name : row.expenseAccount?.name) ?? '',
            onHand,
            row.reorderPoint ?? '',
            row.inventoryAccount?.name ?? '',
            onHand ? asOf : '',
            row.isActive ? 'Yes' : 'No',
          ]
        })
        return workbook(ctx, 'Products & services', 'products-and-services.xlsx', columns, body)
      }

      case 'accounts': {
        const accounts = await accountService.list(ctx, { q, includeInactive: archived, originalChart: true })
        const columns: ListXlsxColumn[] = [
          { header: 'Number', width: 12, kind: 'text' },
          { header: 'Name', width: 28, kind: 'text' },
          { header: 'Type', width: 14, kind: 'text' },
          { header: 'Detail type', width: 18, kind: 'text' },
          { header: 'Balance', width: 14, kind: 'money' },
          { header: 'Active', width: 10, kind: 'text' },
        ]
        const body: CsvCell[][] = accounts.map((account) => [
          account.code,
          account.name,
          account.type,
          account.subtype,
          account.hasChildren ? '' : account.balance,
          account.isActive ? 'Yes' : 'No',
        ])
        return workbook(ctx, 'Chart of accounts', 'chart-of-accounts.xlsx', columns, body)
      }

      default:
        return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Unknown list.' } }, { status: 404 })
    }
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
    }
    console.error('[api/exports]', error)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Request failed.' } }, { status: 500 })
  }
}
