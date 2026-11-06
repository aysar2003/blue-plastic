/**
 * Backfill item description / salesDescription / purchaseDescription from QB items.xml.
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
const xml = fs.readFileSync(path.join(dir, 'items.xml'), 'utf8')

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1].trim() : ''
}
function decode(s) {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

const qb = new Map()
const re =
  /<(ItemInventoryRet|ItemNonInventoryRet|ItemServiceRet|ItemOtherChargeRet|ItemInventoryAssemblyRet|ItemGroupRet|ItemDiscountRet|ItemPaymentRet|ItemSubtotalRet|ItemSalesTaxRet|ItemSalesTaxGroupRet)>([\s\S]*?)<\/\1>/g
let m
while ((m = re.exec(xml))) {
  const block = m[2]
  const name = decode(tag(block, 'Name') || tag(block, 'FullName'))
  if (!name) continue
  qb.set(name.toLowerCase(), {
    salesDesc: decode(tag(block, 'SalesDesc') || tag(block, 'Desc')),
    purchaseDesc: decode(tag(block, 'PurchaseDesc')),
  })
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const items = await prisma.item.findMany({
  where: { orgId: ORG_ID },
  select: { id: true, name: true, description: true, salesDescription: true, purchaseDescription: true },
})

let updated = 0
for (const item of items) {
  const qbRow = qb.get(item.name.toLowerCase())
  if (!qbRow) continue
  const data = {}
  const sales = (qbRow.salesDesc || '').slice(0, 500)
  const purchase = (qbRow.purchaseDesc || '').slice(0, 500)
  if (sales && !(item.salesDescription || '').trim()) data.salesDescription = sales
  if (purchase && !(item.purchaseDescription || '').trim()) data.purchaseDescription = purchase
  if (sales && !(item.description || '').trim()) data.description = sales
  else if (purchase && !(item.description || '').trim()) data.description = purchase
  if (!Object.keys(data).length) continue
  await prisma.item.update({ where: { id: item.id }, data })
  updated++
}

const withSales = await prisma.item.count({
  where: { orgId: ORG_ID, salesDescription: { not: null } },
})
console.log(JSON.stringify({ qbItems: qb.size, dbItems: items.length, updated, withSales }, null, 2))
await prisma.$disconnect()
