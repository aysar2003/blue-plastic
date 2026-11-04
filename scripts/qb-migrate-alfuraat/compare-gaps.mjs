process.loadEnvFile('.env')
import fs from 'node:fs'
import path from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const dirs = [
  path.join(process.env.USERPROFILE ?? 'C:\\Users\\Zmart', 'Desktop', 'qb-alfuraat-export'),
  'C:\\Users\\Zmart\\qb-export',
]
const dir = dirs.find((d) => fs.existsSync(path.join(d, 'items.xml')))

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

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})
const org = await db.organization.findFirst({
  where: { name: { equals: 'AL FURAAT MATERIALS', mode: 'insensitive' } },
})

const dbCust = new Set(
  (await db.customer.findMany({ where: { orgId: org.id }, select: { displayName: true } })).map((c) =>
    c.displayName.toLowerCase(),
  ),
)
const dbVend = new Set(
  (await db.vendor.findMany({ where: { orgId: org.id }, select: { displayName: true } })).map((v) =>
    v.displayName.toLowerCase(),
  ),
)
const dbItems = new Set(
  (await db.item.findMany({ where: { orgId: org.id }, select: { name: true } })).map((i) => i.name.toLowerCase()),
)
const dbInv = new Set(
  (await db.salesDocument.findMany({ where: { orgId: org.id, type: 'INVOICE' }, select: { number: true } })).map(
    (d) => d.number,
  ),
)
const dbBill = new Set(
  (await db.purchaseDocument.findMany({ where: { orgId: org.id, type: 'BILL' }, select: { number: true } })).map(
    (d) => d.number,
  ),
)
const dbAcct = new Set(
  (await db.ledgerAccount.findMany({ where: { orgId: org.id }, select: { name: true } })).map((a) =>
    a.name.toLowerCase(),
  ),
)

const qbCust = blocks(readAll('customers'), 'CustomerRet')
  .map((b) => tag(b, 'FullName') || tag(b, 'Name'))
  .filter(Boolean)
const qbVend = blocks(readAll('vendors'), 'VendorRet')
  .map((b) => tag(b, 'FullName') || tag(b, 'Name'))
  .filter(Boolean)

const kinds = [
  'ItemInventoryRet',
  'ItemNonInventoryRet',
  'ItemServiceRet',
  'ItemOtherChargeRet',
  'ItemDiscountRet',
]
const qbItems = []
const ix = readAll('items')
for (const k of kinds) {
  for (const b of blocks(ix, k)) {
    const n = tag(b, 'FullName') || tag(b, 'Name')
    if (!n) continue
    // Keep leaf name after colon for sub-items
    const leaf = n.includes(':') ? n.split(':').pop().trim() : n
    qbItems.push({ full: n, leaf, kind: k, block: b })
  }
}

const inv = blocks(readAll('invoices'), 'InvoiceRet')
const missingInv = []
const noLineInv = []
for (const b of inv) {
  const n = tag(b, 'RefNumber') || tag(b, 'TxnNumber')
  const lines = blocks(b, 'InvoiceLineRet')
  const itemLines = lines.filter((l) => tag(l.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName'))
  if (!itemLines.length) noLineInv.push(n)
  else if (!dbInv.has(n)) missingInv.push(n)
}

const bills = blocks(readAll('bills'), 'BillRet')
const missingBills = []
for (const b of bills) {
  const n = tag(b, 'RefNumber') || tag(b, 'TxnNumber')
  if (n && !dbBill.has(n)) missingBills.push(n)
}

const je = blocks(readAll('journals'), 'JournalEntryRet')
const jeAccts = new Set()
for (const b of je) {
  for (const line of [...blocks(b, 'JournalDebitLine'), ...blocks(b, 'JournalCreditLine')]) {
    const a = tag(line.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? '', 'FullName')
    if (a) jeAccts.add(a)
  }
}
const missingAccts = [...jeAccts].filter((a) => !dbAcct.has(a.toLowerCase()) && !dbAcct.has(a.split(':').pop().trim().toLowerCase()))

const missingCust = qbCust.filter((n) => !dbCust.has(n.toLowerCase()))
const missingVend = qbVend.filter((n) => !dbVend.has(n.toLowerCase()))
const missingItems = []
const seen = new Set([...dbItems])
for (const it of qbItems) {
  const key = it.leaf.toLowerCase()
  if (seen.has(key)) continue
  seen.add(key)
  missingItems.push(it.leaf)
}

console.log(
  JSON.stringify(
    {
      missingCustomers: missingCust,
      missingVendors: missingVend,
      missingItemCount: missingItems.length,
      missingItemSamples: missingItems.slice(0, 20),
      missingInvoices: missingInv.length,
      missingInvoiceSamples: missingInv.slice(0, 20),
      noLineInvoices: noLineInv.length,
      missingBills: missingBills.length,
      missingBillSamples: missingBills.slice(0, 20),
      missingJournalAccounts: missingAccts,
      qbJournalCount: je.length,
      db: { customers: dbCust.size, vendors: dbVend.size, items: dbItems.size, invoices: dbInv.size, bills: dbBill.size },
    },
    null,
    2,
  ),
)
await db.$disconnect()
