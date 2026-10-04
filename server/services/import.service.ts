import 'server-only'

import { parseCsv, parseTable, pick, type CsvRow, type ImportIssue } from '@/lib/csv'
import { dialogColumns, VENDOR_TEMPLATE } from '@/lib/import-template'
import {
  CONTACT_IMPORT_COLUMNS,
  dateOrderFor,
  ITEM_IMPORT_COLUMNS,
  looseKey,
  matchAccount,
  matchStore,
  shapeContact,
  shapeItem,
} from '@/lib/spreadsheet'
import { customerSchema, itemSchema, vendorSchema } from '@/lib/validation/master-data'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { AppError } from '@/server/errors'
import * as contactService from '@/server/services/contact.service'
import * as itemService from '@/server/services/item.service'
import { workbookRecords } from '@/server/services/workbook'

export type ImportPreview = {
  total: number
  ready: number
  skipped: number
  issues: ImportIssue[]
  sample: { row: number; displayName: string; email: string; balance: string }[]
}

export type ImportResult = ImportPreview & { imported: number }

export type ImportFile = { csv?: string; workbook?: string }

async function readRows(file: ImportFile): Promise<CsvRow[]> {
  if (file.workbook) return parseTable(await workbookRecords(file.workbook)).rows
  return parseCsv(file.csv ?? '').rows
}

/**
 * Import customers or vendors from a spreadsheet, including a QuickBooks Online
 * export (.xlsx or CSV).
 *
 * Every row is checked first. Only the ones that pass are written, each in its
 * own transaction, because an opening balance posts a journal and one bad row
 * must not take a good one's journal with it. A name that already exists is
 * skipped: guessing that two similar names are the same person is how a
 * subledger gets two balances for one customer.
 */
export async function importContacts(
  ctx: OrgContext,
  side: 'customer' | 'vendor',
  file: ImportFile,
  options: { dryRun?: boolean } = {},
): Promise<ImportResult> {
  const rows = await readRows(file)
  const issues: ImportIssue[] = []
  const schema = side === 'customer' ? customerSchema : vendorSchema
  const order = dateOrderFor(ctx.organization.timeZone)

  const existing = new Set(
    (side === 'customer'
      ? await db.customer.findMany({ where: { orgId: ctx.orgId }, select: { displayName: true } })
      : await db.vendor.findMany({ where: { orgId: ctx.orgId }, select: { displayName: true } })
    ).map((record) => record.displayName.toLowerCase()),
  )

  const terms = await db.paymentTerm.findMany({
    where: { orgId: ctx.orgId },
    select: { id: true, name: true },
  })
  const termByName = new Map(terms.map((term) => [looseKey(term.name), term.id]))

  const seenInFile = new Set<string>()
  const valid: { row: number; data: Record<string, unknown>; inactive: boolean }[] = []

  rows.forEach((row, index) => {
    const lineNumber = index + 2

    const termName = pick(row, 'paymentTerms', 'terms', 'payment term', 'payment terms', 'sales term')
    const paymentTermId = termName ? (termByName.get(looseKey(termName)) ?? '') : ''
    if (termName && !paymentTermId) {
      issues.push({
        row: lineNumber,
        field: 'paymentTerms',
        message: `Unknown payment term "${termName}" — imported without one`,
      })
    }

    const shaped = shapeContact(row, { paymentTermId, order })
    for (const warning of shaped.warnings) {
      issues.push({ row: lineNumber, field: warning.field, message: warning.message })
    }
    if (shaped.skip || !shaped.data) {
      if (shaped.skip) issues.push({ row: lineNumber, field: 'displayName', message: shaped.skip })
      return
    }

    const displayName = String(shaped.data.displayName)
    const key = displayName.toLowerCase()
    if (existing.has(key)) {
      issues.push({ row: lineNumber, message: `"${displayName}" already exists — skipped` })
      return
    }
    if (seenInFile.has(key)) {
      issues.push({ row: lineNumber, message: `"${displayName}" appears more than once in this file` })
      return
    }

    const parsed = schema.safeParse(shaped.data)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          row: lineNumber,
          field: issue.path.join('.') || undefined,
          message: issue.message,
        })
      }
      return
    }

    seenInFile.add(key)
    valid.push({ row: lineNumber, data: parsed.data, inactive: shaped.inactive })
  })

  const preview = previewOf(rows.length, valid, issues)

  if (options.dryRun) return { ...preview, imported: 0 }

  let imported = 0
  for (const entry of valid) {
    try {
      const created =
        side === 'customer'
          ? await contactService.createCustomer(ctx, entry.data as never)
          : await contactService.createVendor(ctx, entry.data as never)
      imported += 1
      if (entry.inactive) {
        try {
          await contactService.setActive(ctx, side, [created.id], false)
        } catch (error) {
          if (error instanceof AppError) {
            issues.push({ row: entry.row, message: `${created.displayName} was imported and left active. ${error.message}` })
          } else {
            throw error
          }
        }
      }
    } catch (error) {
      if (error instanceof AppError) {
        issues.push({ row: entry.row, message: error.message })
        continue
      }
      throw error
    }
  }

  return { ...preview, imported, issues: issues.slice(0, 100) }
}

/**
 * Import products and services, including a QuickBooks Online products export.
 *
 * An inventory row with a quantity and a cost posts opening stock, the same
 * journal a person would get by typing the item in. A quantity with no cost is
 * not invented — the product is imported and the quantity is reported as left
 * out. Account names are matched to the chart; a name this chart does not have
 * falls back to the system account for that role, and the preview says so.
 */
export async function importItems(
  ctx: OrgContext,
  file: ImportFile,
  options: { dryRun?: boolean } = {},
): Promise<ImportResult> {
  const rows = await readRows(file)
  const issues: ImportIssue[] = []
  const order = dateOrderFor(ctx.organization.timeZone)

  const [accounts, existingItems, stores, incomeFallback, expenseFallback, inventoryFallback, cogsFallback] =
    await Promise.all([
      db.ledgerAccount.findMany({
        where: { orgId: ctx.orgId, isActive: true },
        select: { id: true, name: true, code: true },
      }),
      db.item.findMany({ where: { orgId: ctx.orgId }, select: { name: true, sku: true } }),
      db.store.findMany({
        where: { orgId: ctx.orgId, isActive: true },
        select: { id: true, name: true, isOffice: true },
        orderBy: [{ isOffice: 'desc' }, { name: 'asc' }],
      }),
      systemId(ctx.orgId, 'UNCATEGORISED_INCOME'),
      systemId(ctx.orgId, 'UNCATEGORISED_EXPENSE'),
      systemId(ctx.orgId, 'INVENTORY_ASSET'),
      systemId(ctx.orgId, 'COGS'),
    ])

  const officeStoreId = stores.find((store) => store.isOffice)?.id ?? stores[0]?.id ?? null

  if (!incomeFallback) {
    return emptyFile(rows.length, 'Install the chart of accounts before importing products.')
  }

  const names = new Set(existingItems.map((item) => item.name.toLowerCase()))
  const skus = new Set(existingItems.filter((item) => item.sku).map((item) => item.sku!.toLowerCase()))
  const seenNames = new Set<string>()
  const seenSkus = new Set<string>()
  const valid: { row: number; data: Record<string, unknown>; inactive: boolean; label: string }[] = []

  rows.forEach((row, index) => {
    const lineNumber = index + 2
    const shaped = shapeItem(row, order)
    for (const warning of shaped.warnings) {
      issues.push({ row: lineNumber, field: warning.field, message: warning.message })
    }
    if (shaped.skip || !shaped.draft) {
      if (shaped.skip) issues.push({ row: lineNumber, message: shaped.skip })
      return
    }

    const draft = shaped.draft
    const nameKey = draft.name.toLowerCase()
    if (names.has(nameKey) || seenNames.has(nameKey)) {
      issues.push({ row: lineNumber, message: `"${draft.name}" already exists — skipped` })
      return
    }
    if (draft.sku) {
      const skuKey = draft.sku.toLowerCase()
      if (skus.has(skuKey) || seenSkus.has(skuKey)) {
        issues.push({ row: lineNumber, message: `SKU "${draft.sku}" is already used — skipped` })
        return
      }
    }

    const incomeAccountId = resolveAccount(draft.incomeAccountName, accounts, incomeFallback, issues, lineNumber, 'Income account')
    const expenseNamed = resolveAccount(
      draft.expenseAccountName,
      accounts,
      draft.type === 'INVENTORY' ? cogsFallback : expenseFallback,
      issues,
      lineNumber,
      'Expense account',
    )
    const inventoryAccountId =
      draft.type === 'INVENTORY'
        ? resolveAccount(draft.inventoryAccountName, accounts, inventoryFallback, issues, lineNumber, 'Inventory asset account')
        : ''

    if (draft.type === 'INVENTORY' && !inventoryAccountId) {
      issues.push({
        row: lineNumber,
        message: 'No inventory asset account is set up, so this tracked product was skipped',
      })
      return
    }
    if (draft.type === 'INVENTORY' && !expenseNamed && !cogsFallback) {
      issues.push({
        row: lineNumber,
        message: 'No cost of goods sold account is set up, so this tracked product was skipped',
      })
      return
    }

    let storeId = ''
    if (draft.type === 'INVENTORY') {
      if (draft.storeName) {
        const matched = matchStore(draft.storeName, stores)
        if (matched) {
          storeId = matched
        } else {
          issues.push({
            row: lineNumber,
            field: 'Store',
            message: `Store "${draft.storeName}" is not set up — opening stock will use the office store if one exists`,
          })
          storeId = officeStoreId ?? ''
        }
      } else if (draft.openingQuantity && officeStoreId) {
        storeId = officeStoreId
      }
    }

    const parsed = itemSchema.safeParse({
      name: draft.name,
      sku: draft.sku,
      type: draft.type,
      description: draft.salesDescription,
      salesDescription: draft.salesDescription,
      salesPrice: draft.salesPrice,
      isTaxable: draft.isTaxable,
      incomeAccountId,
      purchaseDescription: draft.purchaseDescription,
      purchaseCost: draft.purchaseCost,
      expenseAccountId: draft.type === 'INVENTORY' ? '' : (expenseNamed ?? ''),
      inventoryAccountId: inventoryAccountId ?? '',
      cogsAccountId: draft.type === 'INVENTORY' ? (expenseNamed ?? cogsFallback ?? '') : '',
      reorderPoint: draft.reorderPoint,
      storeId,
      openingQuantity: draft.openingQuantity,
      openingUnitCost: draft.openingUnitCost,
      openingDate: draft.openingDate,
      categoryId: '',
      unitOfMeasure: '',
      salesTaxCodeId: '',
      purchaseTaxCodeId: '',
    })

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          row: lineNumber,
          field: issue.path.join('.') || undefined,
          message: issue.message,
        })
      }
      return
    }

    seenNames.add(nameKey)
    if (draft.sku) seenSkus.add(draft.sku.toLowerCase())
    valid.push({
      row: lineNumber,
      data: parsed.data,
      inactive: shaped.inactive,
      label: draft.type === 'INVENTORY' && draft.openingQuantity ? draft.openingQuantity : draft.salesPrice,
    })
  })

  const preview: ImportPreview = {
    total: rows.length,
    ready: valid.length,
    skipped: rows.length - valid.length,
    issues: issues.slice(0, 100),
    sample: valid.slice(0, 10).map((entry) => ({
      row: entry.row,
      displayName: String(entry.data.name ?? ''),
      email: String(entry.data.type ?? ''),
      balance: entry.label,
    })),
  }

  if (options.dryRun) return { ...preview, imported: 0 }

  let imported = 0
  for (const entry of valid) {
    try {
      const created = await itemService.create(ctx, entry.data as never)
      imported += 1
      if (entry.inactive) {
        try {
          await itemService.setActive(ctx, [created.id], false)
        } catch (error) {
          if (error instanceof AppError) {
            issues.push({ row: entry.row, message: `${created.name} was imported and left active. ${error.message}` })
          } else {
            throw error
          }
        }
      }
    } catch (error) {
      if (error instanceof AppError) {
        issues.push({ row: entry.row, message: error.message })
        continue
      }
      throw error
    }
  }

  return { ...preview, imported, issues: issues.slice(0, 100) }
}

function resolveAccount(
  name: string,
  accounts: { id: string; name: string; code: string }[],
  fallback: string | null,
  issues: ImportIssue[],
  row: number,
  label: string,
): string {
  if (!name) return fallback ?? ''
  const matched = matchAccount(name, accounts)
  if (matched) return matched
  if (fallback) {
    issues.push({
      row,
      field: label,
      message: `${label} "${name}" is not on the chart — the system account was used instead`,
    })
    return fallback
  }
  return ''
}

async function systemId(orgId: string, key: 'UNCATEGORISED_INCOME' | 'UNCATEGORISED_EXPENSE' | 'INVENTORY_ASSET' | 'COGS') {
  const account = await db.ledgerAccount.findUnique({
    where: { orgId_systemKey: { orgId, systemKey: key } },
    select: { id: true },
  })
  return account?.id ?? null
}

function previewOf(
  total: number,
  valid: { row: number; data: Record<string, unknown> }[],
  issues: ImportIssue[],
): ImportPreview {
  return {
    total,
    ready: valid.length,
    skipped: total - valid.length,
    issues: issues.slice(0, 100),
    sample: valid.slice(0, 10).map((entry) => ({
      row: entry.row,
      displayName: String(entry.data.displayName ?? ''),
      email: String(entry.data.email ?? ''),
      balance: String(entry.data.openingBalance ?? ''),
    })),
  }
}

function emptyFile(total: number, message: string): ImportResult {
  return {
    total,
    ready: 0,
    skipped: total,
    imported: 0,
    issues: [{ row: 0, message }],
    sample: [],
  }
}

export const IMPORT_COLUMNS = CONTACT_IMPORT_COLUMNS
export const VENDOR_COLUMNS = dialogColumns(VENDOR_TEMPLATE)
export const ITEM_COLUMNS = ITEM_IMPORT_COLUMNS
