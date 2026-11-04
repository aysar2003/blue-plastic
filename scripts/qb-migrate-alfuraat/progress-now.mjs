process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})
const org = await db.organization.findFirst({
  where: { name: { equals: 'AL FURAAT MATERIALS', mode: 'insensitive' } },
})
if (!org) {
  console.log('no org')
  process.exit(0)
}
const counts = {
  invoices: await db.salesDocument.count({ where: { orgId: org.id, type: 'INVOICE' } }),
  bills: await db.purchaseDocument.count({ where: { orgId: org.id, type: 'BILL' } }),
  journals: await db.journal.count({ where: { orgId: org.id } }),
  payments: await db.customerPayment.count({ where: { orgId: org.id } }),
  items: await db.item.count({ where: { orgId: org.id } }),
  customers: await db.customer.count({ where: { orgId: org.id } }),
}
console.log(JSON.stringify(counts))
await db.$disconnect()
