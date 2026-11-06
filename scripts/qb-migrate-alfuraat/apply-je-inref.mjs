/** Apply IN/ scraped from journal memos onto matching invoice numbers. */
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

function readAll(prefix) {
  return fs
    .readdirSync(dir)
    .filter((f) => f === `${prefix}.xml` || (f.startsWith(`${prefix}-part`) && f.endsWith('.xml')))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')
}

const journalsXml = readAll('journals')
const inFromJe = new Map()
for (const m of journalsXml.matchAll(/INVOICE\s+0*(\d+)\b[\s\S]{0,160}?IN\/\s*([A-Za-z0-9._\/\-]+)/gi)) {
  const n = String(Number(m[1]))
  const value = m[2].trim().slice(0, 120)
  const keys = new Set([n, m[1], n.padStart(4, '0'), m[1].padStart(4, '0')])
  for (const key of keys) {
    if (!inFromJe.has(key)) inFromJe.set(key, value)
  }
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

let updated = 0
const samples = []
for (const [number, inRef] of inFromJe) {
  const result = await prisma.salesDocument.updateMany({
    where: { orgId: ORG_ID, type: 'INVOICE', number, OR: [{ inRef: null }, { inRef: '' }] },
    data: { inRef },
  })
  if (result.count) {
    updated += result.count
    samples.push({ number, inRef })
  }
}

const withIn = await prisma.salesDocument.count({
  where: { orgId: ORG_ID, type: 'INVOICE', NOT: { inRef: null }, inRef: { not: '' } },
})

console.log(JSON.stringify({ jeKeys: inFromJe.size, updated, withIn, samples, map: [...inFromJe.entries()] }, null, 2))
await prisma.$disconnect()
