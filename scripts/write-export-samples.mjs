/**
 * Writes sample “before vs after” Excel files to the Desktop for visual review.
 * Run: node scripts/write-export-samples.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const ExcelJS = require('exceljs')
const desktop = path.join(process.env.USERPROFILE || '', 'Desktop')
const outDir = path.join(desktop, 'blue-plastic-export-samples')
fs.mkdirSync(outDir, { recursive: true })

const BRAND = 'FF0B4F6C'
const WHITE = 'FFFFFFFF'
const STRIPE = 'FFF8FAFC'
const GRID = 'FFE2E8F0'
const INK = 'FF0F172A'

function styleHeader(sheet, rowIndex, cols) {
  const row = sheet.getRow(rowIndex)
  row.height = 22
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c)
    cell.font = { bold: true, color: { argb: WHITE }, name: 'Calibri', size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
    cell.alignment = { vertical: 'middle', indent: 1 }
  }
}

function addSimpleTable(sheet, headers, rows, widths) {
  sheet.addRow(headers)
  styleHeader(sheet, 1, headers.length)
  rows.forEach((r, i) => {
    const excelRow = sheet.addRow(r)
    excelRow.height = 18
    for (let c = 1; c <= headers.length; c++) {
      const cell = excelRow.getCell(c)
      cell.font = { name: 'Calibri', size: 10, color: { argb: INK } }
      cell.border = {
        top: { style: 'thin', color: { argb: GRID } },
        left: { style: 'thin', color: { argb: GRID } },
        bottom: { style: 'thin', color: { argb: GRID } },
        right: { style: 'thin', color: { argb: GRID } },
      }
      if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE } }
      }
    }
  })
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w
  })
  sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }]
}

// --- OLD: flat camelCase dump (what staff used to get) ---
{
  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('setup-heal-report')
  addSimpleTable(
    sheet,
    ['Kind', 'Name', 'SKU', 'Id', 'Detail'],
    [
      ['item_missing_sku', '2WAY ANGLE VALVE 1/2', '', 'cmvgvzq8900008jqrk9vax1u', 'Active item has no SKU'],
      ['item_missing_sku', 'A4 PHOTO COPY PAPERS', '', 'cmvh…', 'Active item has no SKU'],
      ['item_missing_tax', '2WAY ANGLE VALVE 1/2', '', 'cmvgvzq8900008jqrk9vax1u', 'Missing sales tax and purchase tax'],
      ['stock_missing_reorder', '2WAY ANGLE VALVE 1/2', '', 'cmvgvzq8900008jqrk9vax1u', 'Stock item has no reorder point'],
      ['customer_missing_country', '0616039162', '', 'cust…', 'Active customer has no billing country'],
    ],
    [22, 36, 10, 28, 40],
  )
  const p = path.join(outDir, '01-OLD-flat-mixed-gaps.xlsx')
  await wb.xlsx.writeFile(p)
  console.log('wrote', p)
}

// --- OLD: camelCase portfolio CSV opened as sheet ---
{
  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('portfolio')
  addSimpleTable(
    sheet,
    ['orgId', 'name', 'ownershipPercent', 'rolledNetIncome', 'nci'],
    [
      ['org_abc', 'Branch Mogadishu', '80.0000', '12000.0000', '3000.0000'],
      ['org_def', 'Branch Hargeisa', '60.0000', '8000.0000', '5333.3333'],
    ],
    [14, 22, 18, 18, 14],
  )
  const p = path.join(outDir, '02-OLD-camelCase-portfolio.xlsx')
  await wb.xlsx.writeFile(p)
  console.log('wrote', p)
}

// --- OLD: P&L one flat sheet with Section column ---
{
  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('Profit and loss')
  addSimpleTable(
    sheet,
    ['Section', 'Code', 'Account', 'Type', 'Detail type', 'Amount', '% of income'],
    [
      ['Income', '4000', 'Sales', 'Income', 'Income', 50000, 100],
      ['Income', '4100', 'Service income', 'Income', 'Income', 12000, 24],
      ['Income', '', 'Total income', '', '', 62000, null],
      ['Cost of goods sold', '5000', 'Purchases', 'Cost of goods sold', 'COGS', 28000, 45.2],
      ['Cost of goods sold', '', 'Total cost of goods sold', '', '', 28000, null],
      ['Operating expenses', '6000', 'Rent', 'Expense', 'Operating expense', 5000, 8.1],
      ['Operating expenses', '', 'Total operating expenses', '', '', 5000, null],
      ['', '', 'Gross profit', '', '', 34000, null],
      ['', '', 'Net income', '', '', 29000, null],
    ],
    [20, 10, 22, 14, 16, 12, 12],
  )
  const p = path.join(outDir, '03-OLD-flat-profit-loss.xlsx')
  await wb.xlsx.writeFile(p)
  console.log('wrote', p)
}

// --- NEW: use real app renderers via tsx if available, else mirror structure ---
async function tryAppSamples() {
  try {
    // Prefer compiled/tsx path through vitest-friendly dynamic import of dist — fall back to mirrored samples.
    const { renderProfitAndLossXlsx } = await import(
      pathToFileURL(path.join(process.cwd(), 'server/reports/statement-xlsx.ts')).href
    ).catch(() => ({ renderProfitAndLossXlsx: null }))
    if (!renderProfitAndLossXlsx) return false
    return false
  } catch {
    return false
  }
}

await tryAppSamples()

// --- NEW: prepared heal (multi-sheet) ---
{
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SOM ERP'

  const summary = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] })
  summary.getColumn(1).width = 32
  summary.getColumn(2).width = 12
  summary.getColumn(3).width = 48
  summary.addRow(['Setup heal — prepared workbook'])
  summary.getRow(1).font = { bold: true, size: 14, color: { argb: BRAND }, name: 'Calibri' }
  summary.addRow(['Sample — same layout as live /api/setup-health/xlsx'])
  summary.addRow([])
  summary.addRow(['Gap', 'Count', 'How to fix'])
  styleHeader(summary, 4, 3)
  summary.addRow(['Items missing SKU', 1390, 'Setup → Generate missing SKUs'])
  summary.addRow(['Stock missing reorder', 1378, 'Setup → Set missing reorder points'])
  summary.addRow(['Items missing tax', 1390, 'Setup → Apply pack tax'])
  summary.addRow(['Customers missing country', 962, 'Setup → Customer countries from org'])

  addSimpleTable(
    wb.addWorksheet('Missing SKUs'),
    ['#', 'Name', 'Category', 'Suggested SKU', 'Id', 'Your SKU (edit)', 'Note'],
    [
      [1, '2WAY ANGLE VALVE 1/2', 'Plumbing / Pipes', '2WAY-ANGLE-VALVE-12', 'cmvg…', '', 'Review then keep or edit'],
      [2, 'A4 PHOTO COPY PAPERS', 'Office Supplies', 'A4-PHOTO-COPY-PAPERS', 'cmvh…', '', 'Review then keep or edit'],
      [3, 'AIR CONDITION UNIT SPLIT 1200', 'HVAC / AC', 'AIR-CONDITION-UNIT-SPLIT-1200', 'cmvi…', '', 'Review then keep or edit'],
    ],
    [6, 36, 18, 28, 14, 16, 24],
  )

  addSimpleTable(
    wb.addWorksheet('Missing Reorder'),
    ['#', 'Name', 'Current SKU', 'Suggested Reorder', 'Id', 'Note'],
    [[1, '2WAY ANGLE VALVE 1/2', '(none — fix SKU first)', 1, 'cmvg…', 'Heal sets reorderPoint = 1']],
    [6, 36, 22, 16, 14, 32],
  )

  addSimpleTable(
    wb.addWorksheet('By Category'),
    ['Category', 'Name', 'Suggested SKU', 'Id'],
    [
      ['HVAC / AC', 'AIR CONDITION UNIT SPLIT 1200', 'AIR-CONDITION-UNIT-SPLIT-1200', 'cmvi…'],
      ['Office Supplies', 'A4 PHOTO COPY PAPERS', 'A4-PHOTO-COPY-PAPERS', 'cmvh…'],
      ['Plumbing / Pipes', '2WAY ANGLE VALVE 1/2', '2WAY-ANGLE-VALVE-12', 'cmvg…'],
    ],
    [18, 36, 28, 14],
  )

  const p = path.join(outDir, '04-NEW-prepared-setup-heal.xlsx')
  await wb.xlsx.writeFile(p)
  console.log('wrote', p)
}

// --- NEW: portfolio human headers + letterhead-ish ---
{
  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('Portfolio subsidiaries', { views: [{ showGridLines: false }] })
  sheet.mergeCells(1, 1, 1, 5)
  sheet.getCell(1, 1).value = 'Blue Plastic'
  sheet.getCell(1, 1).font = { bold: true, size: 14, color: { argb: BRAND }, name: 'Calibri' }
  sheet.mergeCells(2, 1, 2, 5)
  sheet.getCell(2, 1).value = 'Portfolio subsidiaries'
  sheet.getCell(2, 1).font = { bold: true, size: 12, name: 'Calibri' }
  sheet.mergeCells(3, 1, 3, 5)
  sheet.getCell(3, 1).value = 'Prepared Excel · human headers (live default from /api/reports/portfolio/export)'
  sheet.getCell(3, 1).font = { size: 9, color: { argb: 'FF64748B' }, name: 'Calibri' }
  sheet.addRow([])
  const headerRow = sheet.addRow([
    'Organisation Id',
    'Name',
    'Ownership %',
    'Rolled net income',
    'NCI',
  ])
  styleHeader(sheet, headerRow.number, 5)
  ;[
    ['org_abc', 'Branch Mogadishu', 80, 12000, 3000],
    ['org_def', 'Branch Hargeisa', 60, 8000, 5333.33],
  ].forEach((r, i) => {
    const excelRow = sheet.addRow(r)
    for (let c = 1; c <= 5; c++) {
      const cell = excelRow.getCell(c)
      cell.font = { name: 'Calibri', size: 10 }
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE } }
      if (c >= 3) cell.numFmt = c === 3 ? '0.00' : '#,##0.00'
    }
  })
  ;[26, 28, 14, 16, 14].forEach((w, i) => {
    sheet.getColumn(i + 1).width = w
  })
  const p = path.join(outDir, '05-NEW-prepared-portfolio.xlsx')
  await wb.xlsx.writeFile(p)
  console.log('wrote', p)
}

// --- NEW: P&L Cover + Summary + section sheets ---
{
  const wb = new ExcelJS.Workbook()

  const cover = wb.addWorksheet('Cover', { views: [{ showGridLines: false }] })
  cover.getColumn(1).width = 28
  cover.getColumn(2).width = 48
  cover.addRow(['Parameter', 'Value'])
  styleHeader(cover, 1, 2)
  ;[
    ['Report', 'Profit and loss (accrual basis)'],
    ['Period', '2026-01-01 to 2026-01-31'],
    ['Accounting basis', 'Accrual'],
    ['Currency', 'USD'],
    ['Filters', 'None'],
    ['Exported', '2026-11-26 sample'],
  ].forEach((r) => cover.addRow(r))

  const summary = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] })
  summary.getColumn(1).width = 28
  summary.getColumn(2).width = 16
  summary.addRow(['Metric', 'Amount'])
  styleHeader(summary, 1, 2)
  ;[
    ['Total income', 62000],
    ['Cost of goods sold', 28000],
    ['Gross profit', 34000],
    ['Operating expenses', 5000],
    ['Operating profit', 29000],
    ['Net income', 29000],
  ].forEach((r) => {
    const row = summary.addRow(r)
    row.getCell(2).numFmt = '#,##0.00'
  })

  const income = wb.addWorksheet('Income', { views: [{ showGridLines: false }] })
  addSimpleTable(
    income,
    ['Code', 'Account', 'Type', 'Detail type', 'Amount', '% of income'],
    [
      ['4000', 'Sales', 'Income', 'Income', 50000, 80.6],
      ['4100', 'Service income', 'Income', 'Income', 12000, 19.4],
      ['', 'Total income', '', '', 62000, null],
    ],
    [10, 22, 12, 14, 12, 12],
  )
  income.getColumn(5).numFmt = '#,##0.00'

  const cogs = wb.addWorksheet('Cost of goods sold', { views: [{ showGridLines: false }] })
  addSimpleTable(
    cogs,
    ['Code', 'Account', 'Type', 'Detail type', 'Amount', '% of income'],
    [
      ['5000', 'Purchases', 'Cost of goods sold', 'COGS', 28000, 45.2],
      ['', 'Total cost of goods sold', '', '', 28000, null],
    ],
    [10, 22, 16, 10, 12, 12],
  )

  const opex = wb.addWorksheet('Operating expenses', { views: [{ showGridLines: false }] })
  addSimpleTable(
    opex,
    ['Code', 'Account', 'Type', 'Detail type', 'Amount', '% of income'],
    [
      ['6000', 'Rent', 'Expense', 'Operating expense', 5000, 8.1],
      ['', 'Total operating expenses', '', '', 5000, null],
    ],
    [10, 22, 12, 16, 12, 12],
  )

  const p = path.join(outDir, '06-NEW-sectioned-profit-loss.xlsx')
  await wb.xlsx.writeFile(p)
  console.log('wrote', p)
}

// README
const readme = path.join(outDir, 'README.txt')
fs.writeFileSync(
  readme,
  `Blue Plastic — export samples (open these in Excel)

OLD (isku qasan / camelCase):
  01-OLD-flat-mixed-gaps.xlsx      ← sida setup-heal-report hore
  02-OLD-camelCase-portfolio.xlsx
  03-OLD-flat-profit-loss.xlsx     ← P&L hal sheet + Section column

NEW (prepared / modern ERP):
  04-NEW-prepared-setup-heal.xlsx  ← Summary + Missing SKUs + categories
  05-NEW-prepared-portfolio.xlsx   ← human headers + title
  06-NEW-sectioned-profit-loss.xlsx ← Cover + Summary + Income/COGS/Expenses sheets

Live app downloads (login required):
  Setup → Download prepared Excel
  Reports → Profit and loss → Excel
  Portfolio / Franchise / Equity / Hours → Export Excel

Also on Desktop if you generated earlier:
  setup-heal-prepared.xlsx
`,
  'utf8',
)
console.log('wrote', readme)
console.log('FOLDER', outDir)
