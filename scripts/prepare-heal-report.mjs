/**
 * One-off: turn Downloads/setup-heal-report.csv into a multi-sheet prepared workbook.
 * Run: node scripts/prepare-heal-report.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ExcelJS = require('exceljs')
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const n = text[i + 1]
    if (q) {
      if (c === '"' && n === '"') {
        cell += '"'
        i++
      } else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && n === '\n') i++
      row.push(cell)
      if (row.length > 1 || row[0]) rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function slugifyItemName(name) {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  return cleaned.slice(0, 40)
}

function nextBlankSku(taken) {
  let max = 0
  for (const sku of taken) {
    const match = /^sku-(\d+)$/.exec(sku)
    if (!match) continue
    const n = Number(match[1])
    if (Number.isSafeInteger(n) && n > max) max = n
  }
  let n = max + 1
  let candidate = `SKU-${String(n).padStart(5, '0')}`
  while (taken.has(candidate.toLowerCase())) {
    n += 1
    candidate = `SKU-${String(n).padStart(5, '0')}`
  }
  return candidate
}

function skuFromName(name, taken) {
  const base = slugifyItemName(name)
  if (!base) return nextBlankSku(taken)
  let candidate = base
  let n = 2
  while (taken.has(candidate.toLowerCase())) {
    const suffix = `-${n}`
    candidate = `${base.slice(0, Math.max(1, 60 - suffix.length))}${suffix}`
    n += 1
    if (n > 9999) return nextBlankSku(taken)
  }
  return candidate
}

function categorize(name) {
  const n = name.toUpperCase()
  if (/AIR.?CONDITION|R22|R410|HVAC|SPLIT\s*\d|AC\s/.test(n)) return 'HVAC / AC'
  if (/VALVE|PIPE|PLUMB|FAUCET|TAP|ELBOW|TEE\b|NIPPLE|UNION|COUPLING|GASKET|HOSE|FITTING/.test(n))
    return 'Plumbing / Pipes'
  if (/WIRE|CABLE|SWITCH|SOCKET|JUNCTION|BREAKER|CONDUIT|ELECTR|BULB|LAMP|LED|CEILING|BOX/.test(n))
    return 'Electrical'
  if (/WELD|GRIND|DRILL|CUTTER|TOOL|COMPRESSOR|COMPOSOR|MACHINE|PUMP/.test(n))
    return 'Tools / Machines'
  if (/PAPER|A4|PEN|OFFICE|FILE|TONER|INK/.test(n)) return 'Office Supplies'
  if (/BOLT|NUT|SCREW|BRACKET|CLAMP|NAIL|FASTENER|ANCHOR|GLUE|ADHESIVE|TAPE/.test(n))
    return 'Hardware / Fasteners'
  if (/PAINT|THINNER|CEMENT|TILE|BOARD|GYPSUM|STEEL|IRON|SHEET|ANGLE|WOOD/.test(n))
    return 'Building Materials'
  return 'Other'
}

const BRAND = 'FF0B4F6C'
const STRIPE = 'FFF8FAFC'
const GRID = 'FFE2E8F0'
const WHITE = 'FFFFFFFF'
const INK = 'FF0F172A'

function styleHeader(sheet, rowIndex, colCount) {
  const row = sheet.getRow(rowIndex)
  row.height = 22
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c)
    cell.font = { bold: true, color: { argb: WHITE }, name: 'Calibri', size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  }
}

function addTable(sheet, headers, rows, widths) {
  sheet.addRow(headers)
  styleHeader(sheet, 1, headers.length)
  for (let i = 0; i < rows.length; i++) {
    const excelRow = sheet.addRow(rows[i])
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
  }
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w
  })
  sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }]
  if (rows.length) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: headers.length },
    }
  }
}

const csvPath = path.join(process.env.USERPROFILE || '', 'Downloads', 'setup-heal-report.csv')
const outPath = path.join(process.env.USERPROFILE || '', 'Desktop', 'setup-heal-prepared.xlsx')

if (!fs.existsSync(csvPath)) {
  console.error('Missing CSV:', csvPath)
  process.exit(1)
}

const raw = parseCsv(fs.readFileSync(csvPath, 'utf8'))
const data = raw.slice(1).map((r) => ({
  kind: r[0] || '',
  name: r[1] || '',
  sku: r[2] || '',
  id: r[3] || '',
  detail: r[4] || '',
}))

const missingSku = data.filter((d) => d.kind === 'item_missing_sku')
const missingReorder = data.filter((d) => d.kind === 'stock_missing_reorder')
const missingTax = data.filter((d) => d.kind === 'item_missing_tax')
const missingCountry = data.filter((d) => d.kind === 'customer_missing_country')
const orgGap = data.filter((d) => d.kind === 'org_missing_country')

const taken = new Set()
const skuRows = missingSku.map((item, index) => {
  const suggested = skuFromName(item.name, taken)
  taken.add(suggested.toLowerCase())
  const category = categorize(item.name)
  return [index + 1, item.name, category, suggested, item.id, '', 'Review then keep or edit']
})

const categoryCounts = {}
for (const row of skuRows) {
  const cat = row[2]
  categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
}

const wb = new ExcelJS.Workbook()
wb.creator = 'SOM ERP'
wb.created = new Date()

const summary = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] })
summary.getColumn(1).width = 36
summary.getColumn(2).width = 18
summary.getColumn(3).width = 55
summary.addRow(['Setup heal — prepared workbook'])
summary.getRow(1).font = { bold: true, size: 14, color: { argb: BRAND }, name: 'Calibri' }
summary.addRow([`Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`])
summary.getRow(2).font = { size: 9, color: { argb: 'FF64748B' }, name: 'Calibri' }
summary.addRow([])
summary.addRow(['Gap', 'Count', 'How to fix in the app'])
styleHeader(summary, 4, 3)
const summaryRows = [
  ['Items missing SKU', missingSku.length, 'Setup → Fix weaknesses → Generate missing SKUs (or edit Suggested SKU sheet)'],
  ['Stock missing reorder point', missingReorder.length, 'Setup → Fix weaknesses → Set missing reorder points (= 1)'],
  ['Items missing tax', missingTax.length, 'Setup → Fix weaknesses → Apply pack tax to items'],
  ['Customers missing country', missingCountry.length, 'Setup → Fix weaknesses → Customer countries from org'],
  ['Org missing country', orgGap.length, 'Setup → Fix weaknesses → Country from pack'],
]
for (const r of summaryRows) summary.addRow(r)
summary.addRow([])
summary.addRow(['Item category (from name)', 'Count', 'Use to plan SKU prefixes / aisles'])
styleHeader(summary, 11, 3)
const catEntries = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])
for (const [cat, count] of catEntries) summary.addRow([cat, count, ''])
summary.addRow([])
summary.addRow([
  'Sheets',
  '',
  'Missing SKUs has Suggested SKU filled. Reorder / Tax / Customers are ready for heal or manual edit.',
])

addTable(
  wb.addWorksheet('Missing SKUs'),
  ['#', 'Name', 'Category', 'Suggested SKU', 'Id', 'Your SKU (edit)', 'Note'],
  skuRows,
  [6, 42, 20, 28, 28, 18, 28],
)

addTable(
  wb.addWorksheet('Missing Reorder'),
  ['#', 'Name', 'Current SKU', 'Suggested Reorder', 'Id', 'Note'],
  missingReorder.map((item, i) => [
    i + 1,
    item.name,
    item.sku || '(none — fix SKU first)',
    1,
    item.id,
    'Heal sets reorderPoint = 1 when blank',
  ]),
  [6, 42, 22, 18, 28, 36],
)

addTable(
  wb.addWorksheet('Missing Tax'),
  ['#', 'Name', 'Current SKU', 'Detail', 'Id', 'Note'],
  missingTax.map((item, i) => [
    i + 1,
    item.name,
    item.sku || '(none — fix SKU first)',
    item.detail,
    item.id,
    'Heal applies pack default sales + purchase tax',
  ]),
  [6, 42, 22, 32, 28, 40],
)

addTable(
  wb.addWorksheet('Customers no country'),
  ['#', 'Customer', 'Id', 'Suggested Country', 'Note'],
  missingCountry.map((item, i) => [
    i + 1,
    item.name,
    item.id,
    'SO',
    'Heal copies org country; change if customer is abroad',
  ]),
  [6, 36, 28, 18, 48],
)

addTable(
  wb.addWorksheet('By Category'),
  ['Category', 'Item name', 'Suggested SKU', 'Id'],
  skuRows
    .slice()
    .sort((a, b) => String(a[2]).localeCompare(String(b[2])) || String(a[1]).localeCompare(String(b[1])))
    .map((r) => [r[2], r[1], r[3], r[4]]),
  [20, 42, 28, 28],
)

addTable(
  wb.addWorksheet('All gaps (raw)'),
  ['Kind', 'Name', 'SKU', 'Id', 'Detail'],
  data.map((d) => [d.kind, d.name, d.sku, d.id, d.detail]),
  [24, 42, 16, 28, 40],
)

await wb.xlsx.writeFile(outPath)
console.log(
  JSON.stringify(
    {
      outPath,
      totals: {
        missingSku: missingSku.length,
        missingReorder: missingReorder.length,
        missingTax: missingTax.length,
        missingCountry: missingCountry.length,
        orgGap: orgGap.length,
      },
      categories: categoryCounts,
    },
    null,
    2,
  ),
)
