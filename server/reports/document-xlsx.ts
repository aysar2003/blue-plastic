import 'server-only'

import type { Workbook as ExcelWorkbook } from 'exceljs'

import { formatDate, isCalendarDate, toCalendarDate } from '@/lib/date'
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

/**
 * Odoo-style single-document spreadsheet: company header, party, lines, totals.
 * Same payload shape as the PDF renderer so sales and purchases share one builder.
 */
export async function renderDocumentXlsx(input: SalesDocumentPdfInput): Promise<Uint8Array> {
  const Workbook = await loadWorkbookCtor()
  const workbook = new Workbook()
  workbook.creator = 'SOM ERP'
  const sheet = workbook.addWorksheet(input.title.slice(0, 31) || 'Document', {
    views: [{ state: 'frozen', ySplit: 10 }],
  })

  const partyLabel = input.partyLabel ?? 'Customer'
  const isRfq = input.documentType === 'RFQ'
  const asNumber = (value: string | null | undefined) => {
    const amount = Number(value)
    return Number.isFinite(amount) ? amount : 0
  }

  let row = 1
  const put = (col: number, text: string, opts?: { bold?: boolean; size?: number }) => {
    const cell = sheet.getCell(row, col)
    cell.value = text
    if (opts?.bold) cell.font = { ...(cell.font ?? {}), bold: true, size: opts.size ?? 11 }
    else if (opts?.size) cell.font = { ...(cell.font ?? {}), size: opts.size }
  }

  // An RFQ is a blank price sheet: no company name, document title, or vendor name,
  // and no rate copied from the item.
  if (!isRfq) {
    put(1, input.orgName, { bold: true, size: 14 })
    row += 1
    for (const line of input.orgAddress) {
      put(1, line, { size: 10 })
      row += 1
    }
    if (input.orgPhone) {
      put(1, `Phone: ${input.orgPhone}`, { size: 10 })
      row += 1
    }
    if (input.orgEmail) {
      put(1, `Email: ${input.orgEmail}`, { size: 10 })
      row += 1
    }

    row += 1
    put(1, `${input.title} ${input.number}`, { bold: true, size: 13 })
    row += 1
    put(1, `Date: ${calendarLabel(input.date)}`)
    row += 1
    if (input.dueDate) {
      put(1, `Due: ${calendarLabel(input.dueDate)}`)
      row += 1
    }
    if (input.reference) {
      put(1, `Reference: ${input.reference}`)
      row += 1
    }
    if (input.status) {
      put(1, `Status: ${input.status}`)
      row += 1
    }

    row += 1
    put(1, partyLabel, { bold: true })
    row += 1
    put(1, input.customerName, { bold: true })
    row += 1
    for (const line of input.customerAddress) {
      put(1, line, { size: 10 })
      row += 1
    }
    if (input.customerEmail) {
      put(1, input.customerEmail, { size: 10 })
      row += 1
    }
    if (input.customerPhone) {
      put(1, input.customerPhone, { size: 10 })
      row += 1
    }

    row += 1
  }

  if (isRfq) {
    const thin = { style: 'thin' as const, color: { argb: 'FF000000' } }
    const border = { top: thin, left: thin, bottom: thin, right: thin }
    const headers = ['RFQ Ref', 'Product SKU', 'Product', 'Quantity', 'UOM', 'Unit Price', 'Amount']
    headers.forEach((label, index) => {
      const cell = sheet.getCell(1, index + 1)
      cell.value = label
      cell.font = { bold: true, size: 11 }
      cell.alignment = { vertical: 'middle', horizontal: index >= 3 ? 'center' : 'left' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
      cell.border = border
    })
    sheet.getRow(1).height = 22

    input.lines.forEach((line, index) => {
      const r = 2 + index
      const qty = asNumber(line.quantity)
      sheet.getCell(r, 1).value = input.number
      sheet.getCell(r, 2).value = line.sku ?? ''
      sheet.getCell(r, 3).value = line.description
      sheet.getCell(r, 4).value = qty
      sheet.getCell(r, 5).value = line.unitOfMeasure ?? ''
      sheet.getCell(r, 6).value = null
      sheet.getCell(r, 7).value = {
        formula: `IF(F${r}="","",D${r}*F${r})`,
        result: 0,
      }
      for (let col = 1; col <= 7; col++) {
        const cell = sheet.getCell(r, col)
        cell.border = border
        cell.alignment = { vertical: 'middle', horizontal: col >= 4 ? 'center' : 'left' }
      }
      sheet.getCell(r, 4).numFmt = '#,##0.##'
      sheet.getCell(r, 6).numFmt = '#,##0.00'
      sheet.getCell(r, 7).numFmt = '#,##0.00'
    })

    const lastLine = 1 + Math.max(input.lines.length, 1)
    const totalRow = lastLine + 1
    sheet.getCell(totalRow, 6).value = 'Total'
    sheet.getCell(totalRow, 6).font = { bold: true }
    sheet.getCell(totalRow, 6).alignment = { horizontal: 'right' }
    sheet.getCell(totalRow, 7).value = { formula: `SUM(G2:G${lastLine})`, result: 0 }
    sheet.getCell(totalRow, 7).font = { bold: true }
    sheet.getCell(totalRow, 7).numFmt = '#,##0.00'
    for (let col = 1; col <= 7; col++) sheet.getCell(totalRow, col).border = border

    sheet.getColumn(1).width = 16
    sheet.getColumn(2).width = 18
    sheet.getColumn(3).width = 42
    sheet.getColumn(4).width = 12
    sheet.getColumn(5).width = 12
    sheet.getColumn(6).width = 14
    sheet.getColumn(7).width = 14
    sheet.views = [{ state: 'frozen', ySplit: 1 }]

    const buffer = await workbook.xlsx.writeBuffer()
    return new Uint8Array(buffer)
  }

  const headerRow = row
  const headers = ['No', 'Item', 'SKU', 'Qty', 'UoM', 'Rate', 'Amount']
  headers.forEach((label, index) => {
    const cell = sheet.getCell(headerRow, index + 1)
    cell.value = label
    cell.font = { bold: true }
  })
  sheet.getRow(headerRow).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EEF2' },
  }

  const firstLine = headerRow + 1
  input.lines.forEach((line, index) => {
    const r = firstLine + index
    const qty = asNumber(line.quantity)
    const rate = asNumber(line.unitPrice)
    sheet.getCell(r, 1).value = index + 1
    sheet.getCell(r, 2).value = line.description
    sheet.getCell(r, 3).value = line.sku ?? ''
    sheet.getCell(r, 4).value = qty
    sheet.getCell(r, 5).value = line.unitOfMeasure ?? ''
    if (isRfq) sheet.getCell(r, 6).value = null
    else sheet.getCell(r, 6).value = rate
    // Amount follows Qty × Rate, including a rate typed in after the file is opened.
    sheet.getCell(r, 7).value = {
      formula: `IF(OR(D${r}="",F${r}=""),"",D${r}*F${r})`,
      result: isRfq ? 0 : qty * rate,
    }
    sheet.getCell(r, 4).numFmt = '#,##0.##'
    sheet.getCell(r, 6).numFmt = '#,##0.00'
    sheet.getCell(r, 7).numFmt = '#,##0.00'
  })

  const lastLine = firstLine + Math.max(input.lines.length, 1) - 1
  const totalsStart = headerRow + 1 + input.lines.length + 1
  const subtotalRow = totalsStart
  const discountRow = totalsStart + 1
  const taxRow = totalsStart + 2
  const totalRow = totalsStart + 3
  const amountRange = `G${firstLine}:G${lastLine}`

  const writeTotal = (
    r: number,
    label: string,
    value: number | { formula: string; result: number },
  ) => {
    sheet.getCell(r, 6).value = label
    sheet.getCell(r, 6).font = { bold: label === 'Total' || label === 'Balance' }
    sheet.getCell(r, 7).value = value
    sheet.getCell(r, 7).font = { bold: label === 'Total' || label === 'Balance' }
    sheet.getCell(r, 7).numFmt = '#,##0.00'
  }

  writeTotal(subtotalRow, 'Subtotal', {
    formula: `SUM(${amountRange})`,
    result: isRfq ? 0 : asNumber(input.subtotal),
  })
  writeTotal(discountRow, 'Discount', isRfq ? 0 : asNumber(input.discountAmount))
  writeTotal(taxRow, 'Tax', isRfq ? 0 : asNumber(input.taxTotal))
  writeTotal(totalRow, 'Total', {
    formula: `G${subtotalRow}-G${discountRow}+G${taxRow}`,
    result: isRfq ? 0 : asNumber(input.total),
  })

  let next = totalRow + 1
  if (input.amountApplied != null) {
    writeTotal(next, 'Applied', asNumber(input.amountApplied))
    const appliedRow = next
    next += 1
    if (input.balance != null) {
      writeTotal(next, 'Balance', {
        formula: `G${totalRow}-G${appliedRow}`,
        result: asNumber(input.balance),
      })
    }
  } else if (input.balance != null) {
    writeTotal(next, 'Balance', {
      formula: `G${totalRow}`,
      result: asNumber(input.balance),
    })
  }

  if (input.message) {
    const msgRow = next + 1
    sheet.getCell(msgRow, 1).value = 'Message'
    sheet.getCell(msgRow, 1).font = { bold: true }
    sheet.getCell(msgRow + 1, 1).value = input.message
  }

  sheet.getColumn(1).width = 6
  sheet.getColumn(2).width = 36
  sheet.getColumn(3).width = 14
  sheet.getColumn(4).width = 10
  sheet.getColumn(5).width = 8
  sheet.getColumn(6).width = 14
  sheet.getColumn(7).width = 14

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}
