/**
 * Writes ERP-parity sample Excel/CSV to the Desktop.
 * Run: node scripts/write-erp-parity-samples.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ExcelJS = require('exceljs')

const desktop = path.join(process.env.USERPROFILE || '', 'Desktop')
const outDir = path.join(desktop, 'blue-plastic-erp-parity-samples')
fs.mkdirSync(outDir, { recursive: true })

const BRAND = 'FF0B4F6C'
const WHITE = 'FFFFFFFF'
const STRIPE = 'FFF8FAFC'
const GRID = 'FFE2E8F0'
const INK = 'FF0F172A'
const MUTED = 'FF64748B'

function money(n) {
  return Number(n)
}

function styleHeader(sheet, rowIndex, cols) {
  const row = sheet.getRow(rowIndex)
  row.height = 22
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c)
    cell.font = { bold: true, color: { argb: WHITE }, name: 'Calibri', size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
    cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right', indent: 1 }
  }
}

function styleBody(sheet, fromRow, toRow, cols) {
  for (let r = fromRow; r <= toRow; r++) {
    const row = sheet.getRow(r)
    row.height = 18
    for (let c = 1; c <= cols; c++) {
      const cell = row.getCell(c)
      cell.font = { name: 'Calibri', size: 10, color: { argb: INK } }
      cell.border = {
        top: { style: 'thin', color: { argb: GRID } },
        left: { style: 'thin', color: { argb: GRID } },
        bottom: { style: 'thin', color: { argb: GRID } },
        right: { style: 'thin', color: { argb: GRID } },
      }
      if ((r - fromRow) % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE } }
      }
      if (c > 1 && typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }
    }
  }
}

function letterhead(sheet, title, subtitle) {
  sheet.mergeCells('A1:D1')
  sheet.getCell('A1').value = 'Blue Plastic Industries'
  sheet.getCell('A1').font = { name: 'Calibri', size: 14, bold: true, color: { argb: BRAND } }
  sheet.mergeCells('A2:D2')
  sheet.getCell('A2').value = title
  sheet.getCell('A2').font = { name: 'Calibri', size: 12, bold: true, color: { argb: INK } }
  sheet.mergeCells('A3:D3')
  sheet.getCell('A3').value = subtitle
  sheet.getCell('A3').font = { name: 'Calibri', size: 10, color: { argb: MUTED } }
  return 5
}

function addCover(wb, title, params) {
  const sheet = wb.addWorksheet('Cover')
  let row = letterhead(sheet, title, 'Export parameters')
  sheet.getCell(`A${row}`).value = 'Parameter'
  sheet.getCell(`B${row}`).value = 'Value'
  styleHeader(sheet, row, 2)
  row++
  const start = row
  for (const [k, v] of params) {
    sheet.getCell(`A${row}`).value = k
    sheet.getCell(`B${row}`).value = v
    row++
  }
  styleBody(sheet, start, row - 1, 2)
  sheet.getColumn(1).width = 28
  sheet.getColumn(2).width = 48
  sheet.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }]
}

function addTableSheet(wb, name, title, subtitle, headers, rows, widths) {
  const sheet = wb.addWorksheet(name)
  let row = letterhead(sheet, title, subtitle)
  sheet.addRow(headers)
  styleHeader(sheet, row, headers.length)
  const start = row + 1
  for (const r of rows) sheet.addRow(r)
  styleBody(sheet, start, start + rows.length - 1, headers.length)
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w
  })
  sheet.views = [{ state: 'frozen', ySplit: row, showGridLines: false }]
}

function writeCsv(name, headers, rows) {
  const escape = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  const body =
    '\uFEFF' +
    [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n') +
    '\r\n'
  const file = path.join(outDir, name)
  fs.writeFileSync(file, body)
  console.log('wrote', file)
}

// --- 01 P&L with Comparison + Change ---
{
  const wb = new ExcelJS.Workbook()
  addCover(wb, 'Profit and loss (accrual basis)', [
    ['Report', 'Profit and loss (accrual basis)'],
    ['Period', '2026-02-01 to 2026-02-28 (Previous period)'],
    ['Accounting basis', 'Accrual'],
    ['Currency', 'USD'],
    ['Comparison', 'Yes'],
    ['Filters', 'None'],
    ['Exported', '2026-02-28'],
  ])
  addTableSheet(
    wb,
    'Summary',
    'Profit and loss (accrual basis)',
    '2026-02-01 to 2026-02-28',
    ['Metric', 'Amount (USD)', 'Comparison (USD)', 'Change (USD)'],
    [
      ['Total income', money(120000), money(100000), money(20000)],
      ['Cost of goods sold', money(48000), money(40000), money(8000)],
      ['Gross profit', money(72000), money(60000), money(12000)],
      ['Operating expenses', money(12000), money(12000), money(0)],
      ['Operating profit', money(60000), money(48000), money(12000)],
      ['Net income', money(60000), money(48000), money(12000)],
    ],
    [28, 16, 16, 16],
  )
  addTableSheet(
    wb,
    'Income',
    'Income',
    '2026-02-01 to 2026-02-28',
    ['Code', 'Account', 'Type', 'Detail type', 'Amount (USD)', 'Comparison (USD)', 'Change (USD)', '% of income'],
    [
      ['4000', 'Sales', 'Income', 'Income', money(120000), money(100000), money(20000), 100],
      ['', 'Total income', '', '', money(120000), money(100000), money(20000), null],
    ],
    [10, 24, 12, 14, 14, 14, 14, 12],
  )
  const p = path.join(outDir, '01-profit-loss-COMPARE-Change.xlsx')
  await wb.xlsx.writeFile(p)
  console.log('wrote', p)
}

// --- 02 Cash flow with Comparison + Change (NEW) ---
{
  const wb = new ExcelJS.Workbook()
  addCover(wb, 'Statement of cash flows (indirect method)', [
    ['Report', 'Statement of cash flows (indirect method)'],
    ['Period', '2026-02-01 to 2026-02-28 (Previous period)'],
    ['Method', 'Indirect'],
    ['Currency', 'USD'],
    ['Comparison', 'Yes'],
    ['Filters', 'None'],
    ['Exported', '2026-02-28'],
  ])
  addTableSheet(
    wb,
    'Summary',
    'Statement of cash flows',
    '2026-02-01 to 2026-02-28',
    ['Movement', 'Amount (USD)', 'Comparison (USD)', 'Change (USD)'],
    [
      ['Net income', money(60000), money(48000), money(12000)],
      ['Cash from operating activities', money(47000), money(41000), money(6000)],
      ['Cash from investing activities', money(-20000), money(-12000), money(-8000)],
      ['Cash from financing activities', money(10000), money(0), money(10000)],
      ['Net change in cash', money(37000), money(29000), money(8000)],
      ['Cash at the start of the period', money(25000), money(5000), money(20000)],
      ['Cash at the end of the period', money(62000), money(34000), money(28000)],
    ],
    [40, 16, 16, 16],
  )
  addTableSheet(
    wb,
    'Operating activities',
    'Operating activities',
    '2026-02-01 to 2026-02-28',
    ['Movement', 'Amount (USD)', 'Comparison (USD)', 'Change (USD)'],
    [
      ['Net income', money(60000), money(48000), money(12000)],
      ['1100 Accounts Receivable', money(-15000), money(-8000), money(-7000)],
      ['1500 Accumulated Depreciation', money(2000), money(1000), money(1000)],
      ['Cash from operating activities', money(47000), money(41000), money(6000)],
    ],
    [40, 16, 16, 16],
  )
  const p = path.join(outDir, '02-cash-flow-COMPARE-Change.xlsx')
  await wb.xlsx.writeFile(p)
  console.log('wrote', p)
}

// --- 03 Balance sheet ---
{
  const wb = new ExcelJS.Workbook()
  addCover(wb, 'Balance sheet', [
    ['Report', 'Balance sheet'],
    ['As at', '2026-02-28'],
    ['Accounting basis', 'Accrual'],
    ['Currency', 'USD'],
    ['Comparison', 'Yes'],
    ['Filters', 'None'],
    ['Exported', '2026-02-28'],
  ])
  addTableSheet(
    wb,
    'Summary',
    'Balance sheet',
    'As at 2026-02-28',
    ['Metric', 'Amount (USD)', 'Comparison (USD)', 'Change (USD)'],
    [
      ['Total assets', money(62000), money(34000), money(28000)],
      ['Total liabilities', money(0), money(0), money(0)],
      ['Total equity', money(62000), money(34000), money(28000)],
    ],
    [40, 16, 16, 16],
  )
  const p = path.join(outDir, '03-balance-sheet-COMPARE-Change.xlsx')
  await wb.xlsx.writeFile(p)
  console.log('wrote', p)
}

// --- 04 Catalogue Cover + Data ---
{
  const wb = new ExcelJS.Workbook()
  addCover(wb, 'Sales by customer', [
    ['Report', 'Sales by customer'],
    ['Period', '2026-02-01 to 2026-02-28'],
    ['Currency', 'USD'],
    ['Filters', 'None'],
    ['Exported', '2026-02-28'],
  ])
  addTableSheet(
    wb,
    'Data',
    'Sales by customer',
    '2026-02-01 to 2026-02-28',
    ['Customer', 'Documents', 'Amount (USD)', 'Share %'],
    [
      ['Acme Trading', 12, money(45000), 37.5],
      ['Deeqa Supplies', 8, money(30000), 25],
      ['Halgan Markets', 5, money(45000), 37.5],
    ],
    [28, 12, 14, 10],
  )
  const p = path.join(outDir, '04-catalogue-Cover-Data.xlsx')
  await wb.xlsx.writeFile(p)
  console.log('wrote', p)
}

writeCsv(
  '05-cash-flow-Summary.csv',
  ['Metric', 'Amount', 'Comparison', 'Change'],
  [
    ['Net income', '60000.00', '48000.00', '12000.00'],
    ['Cash from operating activities', '47000.00', '41000.00', '6000.00'],
    ['Cash from investing activities', '-20000.00', '-12000.00', '-8000.00'],
    ['Cash from financing activities', '10000.00', '0.00', '10000.00'],
    ['Net change in cash', '37000.00', '29000.00', '8000.00'],
    ['Cash at the start of the period', '25000.00', '5000.00', '20000.00'],
    ['Cash at the end of the period', '62000.00', '34000.00', '28000.00'],
  ],
)

writeCsv(
  '06-profit-loss-Summary.csv',
  ['Metric', 'Amount', 'Comparison', 'Change'],
  [
    ['Total income', '120000.00', '100000.00', '20000.00'],
    ['Cost of goods sold', '48000.00', '40000.00', '8000.00'],
    ['Gross profit', '72000.00', '60000.00', '12000.00'],
    ['Operating expenses', '12000.00', '12000.00', '0.00'],
    ['Operating profit', '60000.00', '48000.00', '12000.00'],
    ['Net income', '60000.00', '48000.00', '12000.00'],
  ],
)

writeCsv(
  '07-catalogue-Data.csv',
  ['Customer', 'Documents', 'Amount', 'Share %'],
  [
    ['Acme Trading', '12', '45000.00', '37.5'],
    ['Deeqa Supplies', '8', '30000.00', '25'],
    ['Halgan Markets', '5', '45000.00', '37.5'],
  ],
)

fs.writeFileSync(
  path.join(outDir, 'README.txt'),
  [
    'SOM ERP — samples from the ERP reports parity pass',
    '',
    '01  P&L Excel — Cover + Summary + sections, Comparison + Change',
    '02  Cash flow Excel — NEW comparison period + Change columns',
    '03  Balance sheet Excel — Comparison + Change',
    '04  Catalogue Excel — Cover + Data (was a single flat sheet)',
    '05  Cash flow CSV twin — same Summary headers as Excel',
    '06  P&L CSV twin — Metric / Amount / Comparison / Change',
    '07  Catalogue CSV twin — same Data headers as Excel',
    '',
    'Open the .xlsx files in Excel. Check sheet tabs: Cover, Summary, then sections.',
    '',
  ].join('\n'),
)
console.log('wrote', path.join(outDir, 'README.txt'))
console.log('\nFolder:', outDir)
