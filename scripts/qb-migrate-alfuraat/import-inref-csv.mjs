/**
 * Import IN/ values from a CSV: number,inRef
 * Usage: node scripts/qb-migrate-alfuraat/import-inref-csv.mjs path\to\inref.csv
 *
 * QB Desktop does not expose the template "IN/" field via SDK (no DataExt / Other).
 * Export from QB UI (invoice list custom column or copy) into CSV, then run this.
 */
import fs from 'node:fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

try {
  process.loadEnvFile('.env')
} catch {
  /* ok */
}

const ORG_ID = 'cmvezuwzw000507l8ewxbhc15'
const file = process.argv[2]
if (!file || !fs.existsSync(file)) {
  console.error('Usage: node scripts/qb-migrate-alfuraat/import-inref-csv.mjs <file.csv>')
  process.exit(1)
}

const text = fs.readFileSync(file, 'utf8')
const rows = []
for (const line of text.split(/\r?\n/)) {
  const t = line.trim()
  if (!t || /^number\s*,/i.test(t)) continue
  const m = t.match(/^"?([^",]+)"?\s*,\s*"?([^"]*)"?$/)
  if (!m) continue
  const number = m[1].trim()
  const inRef = m[2].trim().slice(0, 120)
  if (number && inRef) rows.push({ number, inRef })
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

let updated = 0
let missing = 0
for (const row of rows) {
  const result = await prisma.salesDocument.updateMany({
    where: { orgId: ORG_ID, type: 'INVOICE', number: row.number },
    data: { inRef: row.inRef },
  })
  if (result.count) updated += result.count
  else missing++
}

const withIn = await prisma.salesDocument.count({
  where: { orgId: ORG_ID, type: 'INVOICE', NOT: { inRef: null }, inRef: { not: '' } },
})
console.log(JSON.stringify({ csvRows: rows.length, updated, missing, withIn }, null, 2))
await prisma.$disconnect()
