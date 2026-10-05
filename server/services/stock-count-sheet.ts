import 'server-only'

import type { Workbook as ExcelWorkbook } from 'exceljs'

import { parseCsv, parseTable, pick, type CsvRow } from '@/lib/csv'
import { STOCK_COUNT_HEADERS } from '@/lib/stock-count-sheet'
import type { OrgContext } from '@/server/auth/context'
import { workbookRecords } from '@/server/services/workbook'
import * as inventoryService from '@/server/services/inventory.service'

export type StockCountSheetRow = {
  itemId: string
  sku: string
  name: string
  onHand: string
}

/** Every tracked item, ready to fill in a count offline. */
export async function stockCountSheetRows(ctx: OrgContext): Promise<StockCountSheetRow[]> {
  const stock = await inventoryService.stockOnHand(ctx)
  return stock.items.map((item) => ({
    itemId: item.itemId,
    sku: item.sku ?? '',
    name: item.name,
    onHand: item.quantity.toFixed(2),
  }))
}

/** Excel workbook: fill "Count found", leave the rest. Import brings changes back. */
export async function buildStockCountWorkbook(rows: StockCountSheetRow[]): Promise<Uint8Array> {
  const loaded = (await import('exceljs')) as unknown as {
    Workbook?: new () => ExcelWorkbook
    default?: { Workbook: new () => ExcelWorkbook }
  }
  const Workbook = loaded.Workbook ?? loaded.default?.Workbook
  if (!Workbook) throw new Error('The Excel writer did not load')

  const workbook = new Workbook()
  const sheet = workbook.addWorksheet('Stock count')
  const guide = workbook.addWorksheet('How to fill')

  const header = sheet.getRow(1)
  STOCK_COUNT_HEADERS.forEach((title, index) => {
    const cell = header.getCell(index + 1)
    cell.value = title
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4F6C' } }
  })
  header.height = 22

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(index + 2)
    excelRow.getCell(1).value = row.itemId
    excelRow.getCell(2).value = row.sku
    excelRow.getCell(3).value = row.name
    excelRow.getCell(4).value = Number(row.onHand)
    excelRow.getCell(4).numFmt = '0.00'
    excelRow.getCell(5).value = ''
    excelRow.getCell(6).value = ''
  })

  sheet.getColumn(1).width = 26
  sheet.getColumn(1).hidden = true
  sheet.getColumn(2).width = 14
  sheet.getColumn(3).width = 36
  sheet.getColumn(4).width = 12
  sheet.getColumn(5).width = 14
  sheet.getColumn(6).width = 28
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: STOCK_COUNT_HEADERS.length },
  }

  guide.getCell(1, 1).value = 'How to fill Stock count'
  guide.getCell(1, 1).font = { bold: true, size: 16, color: { argb: 'FF0B4F6C' } }
  guide.mergeCells(1, 1, 1, 3)
  guide.getCell(3, 1).value =
    'Export this file from Adjust stock. Fill only the "Count found" column for products you counted. Leave Count found blank to leave that product alone. Save the file, then Import on the same screen — only the rows you filled are loaded into the adjustment. Do not rename the column headings.'
  guide.getCell(3, 1).alignment = { wrapText: true }
  guide.mergeCells(3, 1, 3, 3)
  guide.getRow(3).height = 80
  guide.getColumn(1).width = 80

  const raw = await workbook.xlsx.writeBuffer()
  return raw instanceof Uint8Array ? new Uint8Array(raw) : new Uint8Array(raw as ArrayBuffer)
}

export async function readStockCountFile(file: { csv?: string; workbook?: string }): Promise<CsvRow[]> {
  if (file.workbook) return parseTable(await workbookRecords(file.workbook)).rows
  if (file.csv) return parseCsv(file.csv).rows
  return []
}

/** Quick check that the file looks like a stock-count sheet. */
export function looksLikeStockCount(rows: CsvRow[]): boolean {
  if (rows.length === 0) return false
  const sample = rows[0]!
  return Boolean(
    pick(sample, 'Count found', 'Counted', 'Count', 'Books say', 'Item ID', 'SKU', 'Name'),
  )
}
