import fs from 'node:fs'
import path from 'node:path'

const dirs = [
  path.join(process.env.USERPROFILE ?? 'C:\\Users\\Zmart', 'Desktop', 'qb-alfuraat-export'),
  'C:\\Users\\Zmart\\qb-export',
]
const dir = dirs.find((d) => fs.existsSync(path.join(d, 'items.xml')))
if (!dir) throw new Error('no export')

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1].trim() : ''
}
const blocks = (xml, name) => {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g')
  const out = []
  let m
  while ((m = re.exec(xml))) out.push(m[1])
  return out
}
const readAll = (prefix) =>
  fs
    .readdirSync(dir)
    .filter((f) => f === `${prefix}.xml` || (f.startsWith(`${prefix}-part`) && f.endsWith('.xml')))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')

const inv = blocks(readAll('invoices'), 'InvoiceRet')
let noLine = 0
let withLine = 0
const noLineSamples = []
for (const b of inv) {
  const n = tag(b, 'RefNumber') || tag(b, 'TxnNumber')
  const lines = blocks(b, 'InvoiceLineRet')
  const itemLines = lines.filter((l) => {
    const ref = l.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? ''
    return Boolean(tag(ref, 'FullName'))
  })
  if (!itemLines.length) {
    noLine++
    if (noLineSamples.length < 5) {
      noLineSamples.push({
        n,
        lineCount: lines.length,
        hasDescOnly: lines.some((l) => tag(l, 'Desc') || tag(l, 'Amount')),
        snippet: lines[0]?.slice(0, 200),
      })
    }
  } else withLine++
}

const cust = blocks(readAll('customers'), 'CustomerRet').map((b) => tag(b, 'FullName') || tag(b, 'Name'))
const vend = blocks(readAll('vendors'), 'VendorRet').map((b) => tag(b, 'FullName') || tag(b, 'Name'))

const kinds = [
  'ItemInventoryRet',
  'ItemNonInventoryRet',
  'ItemServiceRet',
  'ItemOtherChargeRet',
  'ItemDiscountRet',
]
const names = new Set()
const withColon = []
const ix = readAll('items')
for (const k of kinds) {
  for (const b of blocks(ix, k)) {
    const n = tag(b, 'FullName') || tag(b, 'Name')
    if (!n) continue
    if (n.includes(':')) {
      withColon.push(n)
      continue
    }
    names.add(n.toLowerCase())
  }
}

const je = blocks(readAll('journals'), 'JournalEntryRet')
const acctNames = new Set()
for (const b of je) {
  for (const line of [...blocks(b, 'JournalDebitLine'), ...blocks(b, 'JournalCreditLine')]) {
    const ref = line.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? ''
    const a = tag(ref, 'FullName')
    if (a) acctNames.add(a)
  }
}

console.log(
  JSON.stringify(
    {
      dir,
      invoices: { total: inv.length, withItemLines: withLine, noItemLines: noLine, noLineSamples },
      customers: { total: cust.length, names: cust },
      vendors: { total: vend.length, names: vend },
      items: { uniqueNoColon: names.size, withColon: withColon.length, colonSamples: withColon.slice(0, 10) },
      journals: { total: je.length, uniqueAccounts: [...acctNames].sort() },
    },
    null,
    2,
  ),
)
