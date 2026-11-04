process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})
const org = await db.organization.findFirst({
  where: { name: { equals: 'AL FURAAT MATERIALS', mode: 'insensitive' } },
})
const accts = await db.ledgerAccount.findMany({
  where: { orgId: org.id },
  select: { name: true, code: true, type: true, subtype: true },
  orderBy: { name: 'asc' },
})
const counts = {
  journals: await db.journal.count({ where: { orgId: org.id } }),
  qbJe: await db.journal.count({ where: { orgId: org.id, idempotencyKey: { startsWith: 'qb-je-' } } }),
  payments: await db.customerPayment.count({ where: { orgId: org.id } }),
  invoices: await db.salesDocument.count({ where: { orgId: org.id, type: 'INVOICE' } }),
  bills: await db.purchaseDocument.count({ where: { orgId: org.id, type: 'BILL' } }),
}
console.log(JSON.stringify({ counts, accounts: accts }, null, 2))
await db.$disconnect()
