process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})
const org = await db.organization.findFirst({
  where: { name: { equals: 'AL FURAAT MATERIALS', mode: 'insensitive' } },
})
const customers = await db.customer.findMany({
  where: { orgId: org.id },
  select: { displayName: true },
  orderBy: { displayName: 'asc' },
})
const vendors = await db.vendor.findMany({
  where: { orgId: org.id },
  select: { displayName: true },
  orderBy: { displayName: 'asc' },
})
const items = await db.item.count({ where: { orgId: org.id } })
const invNums = await db.salesDocument.findMany({
  where: { orgId: org.id, type: 'INVOICE' },
  select: { number: true },
})
const billNums = await db.purchaseDocument.findMany({
  where: { orgId: org.id, type: 'BILL' },
  select: { number: true },
})
const accounts = await db.ledgerAccount.findMany({
  where: { orgId: org.id },
  select: { name: true },
})
console.log(
  JSON.stringify(
    {
      customers: customers.map((c) => c.displayName),
      vendors: vendors.map((v) => v.displayName),
      itemCount: items,
      invoiceNumbers: invNums.map((i) => i.number),
      billCount: billNums.length,
      accountNames: accounts.map((a) => a.name).sort(),
    },
    null,
    2,
  ),
)
await db.$disconnect()
