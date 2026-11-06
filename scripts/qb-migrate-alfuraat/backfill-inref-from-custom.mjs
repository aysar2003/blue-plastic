/**
 * Fill sales_documents.inRef from QB invoice DataExt / Other fields.
 * Reads invoices-custom-part*.xml if present, else invoices-part*.xml.
 */
import fs from 'node:fs'
import path from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

try {
  process.loadEnvFile('.env')
} catch {
  /* ok */
}

const ORG_ID = 'cmvezuwzw000507l8ewxbhc15'
const dir = 'C:\\Users\\Zmart\\Desktop\\qb-alfuraat-export'

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1].trim() : ''
}
function blocks(xml, name) {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g')
  const out = []
  let m
  while ((m = re.exec(xml))) out.push(m[1])
  return out
}
function decode(s) {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

const files = fs
  .readdirSync(dir)
  .filter(
    (f) =>
      (f.startsWith('invoices-custom-part') || f.startsWith('invoices-part') || f === 'invoices.xml') &&
      f.endsWith('.xml'),
  )
  .sort()
const preferCustom = files.some((f) => f.startsWith('invoices-custom-part'))
const chosen = preferCustom ? files.filter((f) => f.startsWith('invoices-custom-part')) : files
const xml = chosen.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')

function inRefFrom(block) {
  const values = []
  for (const d of blocks(block, 'DataExtRet')) {
    const name = tag(d, 'DataExtName').toUpperCase()
    const value = decode(tag(d, 'DataExtValue')).trim()
    if (!value) continue
    if (name === 'IN/' || name === 'IN' || name.includes('IN/') || name === 'IN NUMBER' || name === 'IN NO') {
      values.push(value)
    }
  }
  if (values.length) return values.join(' ').slice(0, 120)
  const other = [tag(block, 'Other'), tag(block, 'Other1'), tag(block, 'Other2')]
    .map((v) => decode(v).trim())
    .filter(Boolean)
  return other.join(' ').slice(0, 120)
}

const byNumber = new Map()
let withIn = 0
let withAnyExt = 0
for (const block of blocks(xml, 'InvoiceRet')) {
  const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
  if (!number) continue
  if (blocks(block, 'DataExtRet').length) withAnyExt++
  const inRef = inRefFrom(block)
  if (inRef) {
    withIn++
    byNumber.set(number, inRef)
  }
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

let updated = 0
const docs = await prisma.salesDocument.findMany({
  where: { orgId: ORG_ID, type: 'INVOICE' },
  select: { id: true, number: true, inRef: true },
})
for (const doc of docs) {
  const inRef = byNumber.get(doc.number)
  if (!inRef) continue
  if (doc.inRef === inRef) continue
  await prisma.salesDocument.update({ where: { id: doc.id }, data: { inRef } })
  updated++
}

const sample = await prisma.salesDocument.findFirst({
  where: { orgId: ORG_ID, type: 'INVOICE', number: '0970' },
  select: { number: true, reference: true, inRef: true },
})

console.log(
  JSON.stringify(
    {
      source: preferCustom ? 'invoices-custom-part*' : 'invoices-part*',
      qbInvoicesWithDataExt: withAnyExt,
      qbInvoicesWithIn: withIn,
      updated,
      sample0970: sample,
      sampleInValues: [...byNumber.entries()].slice(0, 5),
    },
    null,
    2,
  ),
)
await prisma.$disconnect()
