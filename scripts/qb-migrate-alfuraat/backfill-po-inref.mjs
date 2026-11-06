/**
 * Backfill sales invoice P.O. NO. (reference) from QuickBooks PONumber.
 * IN/ (inRef) from Other / Other1 / DataExt named IN when present.
 *
 * Usage: node scripts/qb-migrate-alfuraat/backfill-po-inref.mjs
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
function readAll(prefix) {
  return fs
    .readdirSync(dir)
    .filter((f) => f === `${prefix}.xml` || (f.startsWith(`${prefix}-part`) && f.endsWith('.xml')))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')
}
function inRefFrom(block) {
  for (const d of blocks(block, 'DataExtRet')) {
    const name = tag(d, 'DataExtName').toUpperCase()
    if (name === 'IN/' || name === 'IN' || name.includes('IN/')) {
      const value = tag(d, 'DataExtValue')
      if (value) return value
    }
  }
  return tag(block, 'Other') || tag(block, 'Other1') || tag(block, 'Other2') || ''
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const qb = new Map()
for (const block of blocks(readAll('invoices'), 'InvoiceRet')) {
  const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
  if (!number) continue
  qb.set(number, {
    po: tag(block, 'PONumber') || null,
    inRef: inRefFrom(block) || null,
  })
}

const docs = await prisma.salesDocument.findMany({
  where: { orgId: ORG_ID, type: 'INVOICE' },
  select: { id: true, number: true, reference: true, inRef: true },
})

const poCases = []
const inCases = []
for (const doc of docs) {
  const row = qb.get(doc.number)
  if (!row) continue
  if (row.po && !doc.reference) {
    poCases.push({ id: doc.id, po: row.po.slice(0, 60) })
  }
  if (row.inRef && !doc.inRef) {
    inCases.push({ id: doc.id, inRef: row.inRef.slice(0, 120) })
  }
}

// Batch via CASE WHEN to avoid hundreds of round-trips.
async function applyPo(batch) {
  if (!batch.length) return
  const ids = batch.map((r) => r.id)
  const caseSql = batch.map((r) => `WHEN '${r.id}' THEN '${r.po.replace(/'/g, "''")}'`).join(' ')
  await prisma.$executeRawUnsafe(
    `UPDATE sales_documents SET reference = CASE id ${caseSql} END, "updatedAt" = NOW()
     WHERE id = ANY($1::text[]) AND reference IS NULL`,
    ids,
  )
}

async function applyIn(batch) {
  if (!batch.length) return
  const ids = batch.map((r) => r.id)
  const caseSql = batch.map((r) => `WHEN '${r.id}' THEN '${r.inRef.replace(/'/g, "''")}'`).join(' ')
  await prisma.$executeRawUnsafe(
    `UPDATE sales_documents SET "inRef" = CASE id ${caseSql} END, "updatedAt" = NOW()
     WHERE id = ANY($1::text[]) AND "inRef" IS NULL`,
    ids,
  )
}

const CHUNK = 80
for (let i = 0; i < poCases.length; i += CHUNK) {
  await applyPo(poCases.slice(i, i + CHUNK))
  console.log('PO chunk', Math.min(i + CHUNK, poCases.length), '/', poCases.length)
}
for (let i = 0; i < inCases.length; i += CHUNK) {
  await applyIn(inCases.slice(i, i + CHUNK))
  console.log('IN/ chunk', Math.min(i + CHUNK, inCases.length), '/', inCases.length)
}

const sample = await prisma.salesDocument.findFirst({
  where: { orgId: ORG_ID, type: 'INVOICE', number: '0970' },
  select: { number: true, reference: true, inRef: true },
})
console.log(
  JSON.stringify(
    { scanned: docs.length, poUpdated: poCases.length, inUpdated: inCases.length, sample0970: sample },
    null,
    2,
  ),
)
await prisma.$disconnect()
