import 'server-only'

import type { Borders, Workbook as ExcelWorkbook, Worksheet } from 'exceljs'

import { formatDate, isCalendarDate, toCalendarDate } from '@/lib/date'
import { applyPrintChrome, XLSX_LOOK } from '@/server/reports/list-xlsx'
import type { SalesDocumentPdfInput } from '@/server/reports/sales-document-pdf'

async function loadWorkbookCtor() {
  const loaded = (await import('exceljs')) as unknown as {
    Workbook?: new () => ExcelWorkbook
    default?: { Workbook: new () => ExcelWorkbook }
  }
  const Workbook = loaded.Workbook ?? loaded.default?.Workbook
  if (!Workbook) throw new Error('The Excel writer did not load')
  return Workbook
}

function calendarLabel(value: Date | string | null | undefined): string {
  if (value == null) return ''
  if (typeof value === 'string' && isCalendarDate(value)) return formatDate(value)
  if (value instanceof Date) return formatDate(toCalendarDate(value))
  return String(value)
}

function solid(argb: string) {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } }
}

function thin(argb: string): Partial<Borders> {
  return {
    top: { style: 'thin', color: { argb } },
    left: { style: 'thin', color: { argb } },
    bottom: { style: 'thin', color: { argb } },
    right: { style: 'thin', color: { argb } },
  }
}

function font(partial: { bold?: boolean; size?: number; color?: string; italic?: boolean } = {}) {
  return {
    name: XLSX_LOOK.font,
    size: partial.size ?? 11,
    bold: partial.bold,
    italic: partial.italic,
    color: partial.color ? { argb: partial.color } : { argb: XLSX_LOOK.ink },
  }
}

function paintBrandBand(sheet: Worksheet, orgName: string, contactBits: string[], colCount: number): number {
  let row = 1
  const brand = sheet.getCell(row, 1)
  brand.value = orgName
  brand.font = font({ bold: true, size: 16, color: XLSX_LOOK.white })
  brand.fill = solid(XLSX_LOOK.brand)
  brand.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  if (colCount > 1) sheet.mergeCells(row, 1, row, colCount)
  for (let c = 2; c <= colCount; c++) sheet.getCell(row, c).fill = solid(XLSX_LOOK.brand)
  sheet.getRow(row).height = 28
  row += 1

  if (contactBits.length > 0) {
    const contact = sheet.getCell(row, 1)
    contact.value = contactBits.join('  ·  ')
    contact.font = font({ size: 9, color: XLSX_LOOK.muted })
    contact.fill = solid(XLSX_LOOK.brandSoft)
    contact.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true }
    if (colCount > 1) sheet.mergeCells(row, 1, row, colCount)
    for (let c = 2; c <= colCount; c++) sheet.getCell(row, c).fill = solid(XLSX_LOOK.brandSoft)
    sheet.getRow(row).height = 20
    row += 1
  }

  return row + 1
}

function asText(sheet: Worksheet, row: number, col: number, value: string) {
  const cell = sheet.getCell(row, col)
  cell.value = value
  cell.numFmt = '@'
  return cell
}

/**
 * Professional single-document spreadsheet: company band, party, lines, totals.
 * Same payload shape as the PDF renderer so sales and purchases share one builder.
 */
export async function renderDocumentXlsx(input: SalesDocumentPdfInput): Promise<Uint8Array> {
  const Workbook = await loadWorkbookCtor()
  const workbook = new Workbook()
  workbook.creator = 'SOM ERP'
  workbook.company = input.orgName || 'SOM ERP'

  const partyLabel = input.partyLabel ?? 'Customer'
  const isRfq = input.documentType === 'RFQ'
  const colCount = isRfq ? 7 : 7
  const asNumber = (value: string | null | undefined) => {
    const amount = Number(value)
    return Number.isFinite(amount) ? amount : 0
  }

  const sheet = workbook.addWorksheet(input.title.slice(0, 31) || 'Document', {
    properties: { defaultRowHeight: 18 },
    views: [{ showGridLines: false }],
  })

  const contactBits = [
    ...input.orgAddress,
    input.orgPhone ? `Phone ${input.orgPhone}` : '',
    input.orgEmail ? `Email ${input.orgEmail}` : '',
  ].filter(Boolean)

  let row = paintBrandBand(sheet, input.orgName || 'Company', contactBits, colCount)

  if (isRfq) {
    const titleCell = sheet.getCell(row, 1)
    titleCell.value = `Request for quotation ${input.number}`
    titleCell.font = font({ bold: true, size: 14 })
    sheet.mergeCells(row, 1, row, colCount)
    row += 1
    const meta = sheet.getCell(row, 1)
    meta.value = `Date ${calendarLabel(input.date)}  ·  Fill Unit Price; Amount calculates automatically`
    meta.font = font({ size: 9, color: XLSX_LOOK.muted })
    sheet.mergeCells(row, 1, row, colCount)
    row += 2

    const headers = ['RFQ Ref', 'Product SKU', 'Product', 'Quantity', 'UOM', 'Unit Price', 'Amount']
    const headerRow = row
    headers.forEach((label, index) => {
      const cell = sheet.getCell(headerRow, index + 1)
      cell.value = label
      cell.font = font({ bold: true, size: 10, color: XLSX_LOOK.white })
      cell.fill = solid(XLSX_LOOK.brand)
      cell.border = thin(XLSX_LOOK.brand)
      cell.alignment = { vertical: 'middle', horizontal: index >= 3 ? 'center' : 'left', indent: 1 }
    })
    sheet.getRow(headerRow).height = 24
    row += 1

    input.lines.forEach((line, index) => {
      const r = row + index
      const qty = asNumber(line.quantity)
      asText(sheet, r, 1, input.number)
      asText(sheet, r, 2, line.sku ?? '')
      asText(sheet, r, 3, line.description)
      sheet.getCell(r, 4).value = qty
      asText(sheet, r, 5, line.unitOfMeasure ?? '')
      sheet.getCell(r, 6).value = null
      sheet.getCell(r, 7).value = { formula: `IF(F${r}="","",D${r}*F${r})`, result: 0 }
      for (let col = 1; col <= 7; col++) {
        const cell = sheet.getCell(r, col)
        cell.border = thin(XLSX_LOOK.grid)
        cell.font = font({ size: 10 })
        if (index % 2 === 1) cell.fill = solid(XLSX_LOOK.stripe)
        cell.alignment = { vertical: 'middle', horizontal: col >= 4 ? 'center' : 'left' }
      }
      sheet.getCell(r, 4).numFmt = '#,##0.##'
      sheet.getCell(r, 6).numFmt = '#,##0.00'
      sheet.getCell(r, 7).numFmt = '#,##0.00'
    })

    const lastLine = row + Math.max(input.lines.length, 1) - 1
    const totalRow = lastLine + 1
    sheet.getCell(totalRow, 6).value = 'Total'
    sheet.getCell(totalRow, 6).font = font({ bold: true })
    sheet.getCell(totalRow, 6).alignment = { horizontal: 'right' }
    sheet.getCell(totalRow, 7).value = { formula: `SUM(G${row}:G${lastLine})`, result: 0 }
    sheet.getCell(totalRow, 7).font = font({ bold: true })
    sheet.getCell(totalRow, 7).numFmt = '#,##0.00'
    for (let col = 1; col <= 7; col++) sheet.getCell(totalRow, col).border = thin(XLSX_LOOK.grid)

    const foot = sheet.getCell(totalRow + 2, 1)
    foot.value = 'Prepared with SOM ERP'
    foot.font = font({ size: 8, italic: true, color: XLSX_LOOK.muted })

    sheet.getColumn(1).width = 16
    sheet.getColumn(2).width = 18
    sheet.getColumn(3).width = 42
    sheet.getColumn(4).width = 12
    sheet.getColumn(5).width = 12
    sheet.getColumn(6).width = 14
    sheet.getColumn(7).width = 14
    sheet.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }]
    applyPrintChrome(sheet, {
      companyName: input.orgName || 'Company',
      title: `RFQ ${input.number}`,
      headerRowIndex: headerRow,
      colCount: 7,
    })

    const buffer = await workbook.xlsx.writeBuffer()
    return new Uint8Array(buffer)
  }

  const titleCell = sheet.getCell(row, 1)
  titleCell.value = `${input.title} ${input.number}`
  titleCell.font = font({ bold: true, size: 14 })
  sheet.mergeCells(row, 1, row, colCount)
  row += 1

  const metaBits = [
    `Date ${calendarLabel(input.date)}`,
    input.dueDate ? `Due ${calendarLabel(input.dueDate)}` : '',
    input.reference ? `Reference ${input.reference}` : '',
    input.status ? `Status ${input.status}` : '',
    input.currency ? `Currency ${input.currency}` : '',
  ].filter(Boolean)
  const meta = sheet.getCell(row, 1)
  meta.value = metaBits.join('  ·  ')
  meta.font = font({ size: 9, color: XLSX_LOOK.muted })
  sheet.mergeCells(row, 1, row, colCount)
  row += 2

  sheet.getCell(row, 1).value = partyLabel
  sheet.getCell(row, 1).font = font({ bold: true, size: 10, color: XLSX_LOOK.muted })
  row += 1
  sheet.getCell(row, 1).value = input.customerName
  sheet.getCell(row, 1).font = font({ bold: true, size: 12 })
  row += 1
  for (const line of input.customerAddress) {
    sheet.getCell(row, 1).value = line
    sheet.getCell(row, 1).font = font({ size: 10, color: XLSX_LOOK.muted })
    row += 1
  }
  if (input.customerEmail) {
    asText(sheet, row, 1, input.customerEmail).font = font({ size: 10, color: XLSX_LOOK.muted })
    row += 1
  }
  if (input.customerPhone) {
    asText(sheet, row, 1, input.customerPhone).font = font({ size: 10, color: XLSX_LOOK.muted })
    row += 1
  }
  row += 1

  const headers = ['No', 'Item', 'SKU', 'Qty', 'UoM', 'Rate', 'Amount']
  const headerRow = row
  headers.forEach((label, index) => {
    const cell = sheet.getCell(headerRow, index + 1)
    cell.value = label
    cell.font = font({ bold: true, size: 10, color: XLSX_LOOK.white })
    cell.fill = solid(XLSX_LOOK.brand)
    cell.border = thin(XLSX_LOOK.brand)
    cell.alignment = {
      vertical: 'middle',
      horizontal: index === 0 || index >= 3 ? 'center' : 'left',
      indent: 1,
    }
  })
  sheet.getRow(headerRow).height = 24

  const firstLine = headerRow + 1
  input.lines.forEach((line, index) => {
    const r = firstLine + index
    const qty = asNumber(line.quantity)
    const rate = asNumber(line.unitPrice)
    sheet.getCell(r, 1).value = index + 1
    asText(sheet, r, 2, line.description)
    asText(sheet, r, 3, line.sku ?? '')
    sheet.getCell(r, 4).value = qty
    asText(sheet, r, 5, line.unitOfMeasure ?? '')
    sheet.getCell(r, 6).value = rate
    sheet.getCell(r, 7).value = {
      formula: `IF(OR(D${r}="",F${r}=""),"",D${r}*F${r})`,
      result: qty * rate,
    }
    for (let col = 1; col <= 7; col++) {
      const cell = sheet.getCell(r, col)
      cell.border = thin(XLSX_LOOK.grid)
      cell.font = font({ size: 10 })
      if (index % 2 === 1) cell.fill = solid(XLSX_LOOK.stripe)
      cell.alignment = {
        vertical: 'middle',
        horizontal: col === 1 || col >= 4 ? 'center' : 'left',
      }
    }
    sheet.getCell(r, 4).numFmt = '#,##0.##'
    sheet.getCell(r, 6).numFmt = '#,##0.00'
    sheet.getCell(r, 7).numFmt = '#,##0.00'
  })

  const lastLine = firstLine + Math.max(input.lines.length, 1) - 1
  const totalsStart = headerRow + 1 + input.lines.length + 1
  const amountRange = `G${firstLine}:G${lastLine}`

  const writeTotal = (
    r: number,
    label: string,
    value: number | { formula: string; result: number },
  ) => {
    sheet.getCell(r, 6).value = label
    sheet.getCell(r, 6).font = font({ bold: label === 'Total' || label === 'Balance' })
    sheet.getCell(r, 6).alignment = { horizontal: 'right', vertical: 'middle' }
    sheet.getCell(r, 7).value = value
    sheet.getCell(r, 7).font = font({ bold: label === 'Total' || label === 'Balance' })
    sheet.getCell(r, 7).numFmt = '#,##0.00'
    sheet.getCell(r, 7).border = thin(XLSX_LOOK.grid)
  }

  writeTotal(totalsStart, 'Subtotal', {
    formula: `SUM(${amountRange})`,
    result: asNumber(input.subtotal),
  })
  writeTotal(totalsStart + 1, 'Discount', asNumber(input.discountAmount))
  writeTotal(totalsStart + 2, 'Tax', asNumber(input.taxTotal))
  writeTotal(totalsStart + 3, 'Total', {
    formula: `G${totalsStart}-G${totalsStart + 1}+G${totalsStart + 2}`,
    result: asNumber(input.total),
  })

  let next = totalsStart + 4
  if (input.amountApplied != null) {
    writeTotal(next, 'Applied', asNumber(input.amountApplied))
    const appliedRow = next
    next += 1
    if (input.balance != null) {
      writeTotal(next, 'Balance', {
        formula: `G${totalsStart + 3}-G${appliedRow}`,
        result: asNumber(input.balance),
      })
      next += 1
    }
  } else if (input.balance != null) {
    writeTotal(next, 'Balance', {
      formula: `G${totalsStart + 3}`,
      result: asNumber(input.balance),
    })
    next += 1
  }

  if (input.message) {
    sheet.getCell(next + 1, 1).value = 'Message'
    sheet.getCell(next + 1, 1).font = font({ bold: true, size: 10 })
    sheet.getCell(next + 2, 1).value = input.message
    sheet.getCell(next + 2, 1).font = font({ size: 10, color: XLSX_LOOK.muted })
    next += 3
  }

  const foot = sheet.getCell(next + 1, 1)
  foot.value = 'Prepared with SOM ERP'
  foot.font = font({ size: 8, italic: true, color: XLSX_LOOK.muted })

  sheet.getColumn(1).width = 6
  sheet.getColumn(2).width = 36
  sheet.getColumn(3).width = 14
  sheet.getColumn(4).width = 10
  sheet.getColumn(5).width = 8
  sheet.getColumn(6).width = 14
  sheet.getColumn(7).width = 14
  sheet.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }]
  applyPrintChrome(sheet, {
    companyName: input.orgName || 'Company',
    title: `${input.title} ${input.number}`,
    headerRowIndex: headerRow,
    colCount: 7,
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}
