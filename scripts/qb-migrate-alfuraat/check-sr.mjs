process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const org = await db.organization.findFirst({
  where: { name: { equals: 'AL FURAAT GROUP OF COMPANY', mode: 'insensitive' } },
  select: { id: true },
})
const doc = await db.salesDocument.findFirst({
  where: { orgId: org.id, number: 'SR-12816' },
  select: {
    id: true,
    number: true,
    status: true,
    total: true,
    journalId: true,
    createdAt: true,
    type: true,
    paymentMethod: true,
  },
})
const latest = await db.salesDocument.findMany({
  where: { orgId: org.id, type: 'SALES_RECEIPT' },
  orderBy: { createdAt: 'desc' },
  take: 5,
  select: { number: true, status: true, total: true, journalId: true, createdAt: true },
})
const stillOnHeading = await db.item.count({
  where: {
    orgId: org.id,
    type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
    cogsAccount: { systemKey: 'COGS' },
  },
})
console.log(JSON.stringify({ doc, latest, stillOnHeading }, null, 2))
await db.$disconnect()
