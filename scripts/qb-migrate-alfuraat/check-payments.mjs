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
const existing = new Set(
  (
    await db.journal.findMany({
      where: { orgId: org.id, idempotencyKey: { startsWith: 'qb-pmt-' } },
      select: { idempotencyKey: true },
    })
  )
    .map((j) => j.idempotencyKey)
    .filter(Boolean),
)
const custs = new Set(
  (await db.customer.findMany({ where: { orgId: org.id }, select: { displayName: true } })).map((c) =>
    c.displayName.toLowerCase(),
  ),
)
const payments = await db.customerPayment.findMany({
  where: { orgId: org.id },
  select: { number: true, amount: true, date: true },
})
const payNums = new Set(payments.map((p) => p.number))

const missing = []
for (const b of blocks(readAll('payments'), 'ReceivePaymentRet')) {
  const txnId = tag(b, 'TxnID')
  const key = `qb-pmt-${txnId}`
  const ref = tag(b, 'RefNumber')
  const cust = tag(b.match(/<CustomerRef>[\s\S]*?<\/CustomerRef>/)?.[0] ?? '', 'FullName')
  const amt = tag(b, 'TotalAmount')
  const date = tag(b, 'TxnDate')
  const reasons = []
  if (existing.has(key)) reasons.push('keyExists')
  if (ref && payNums.has(ref)) reasons.push('numExists')
  if (!custs.has((cust || '').toLowerCase())) reasons.push('noCustomer')
  if (!date) reasons.push('noDate')
  if (!(Number(amt) > 0)) reasons.push('zeroAmt')
  if (reasons.length) missing.push({ ref, cust, amt, date, txnId, reasons })
}
console.log(JSON.stringify({ qb: 47, dbPayments: payments.length, existingKeys: existing.size, flagged: missing }, null, 2))
await db.$disconnect()
