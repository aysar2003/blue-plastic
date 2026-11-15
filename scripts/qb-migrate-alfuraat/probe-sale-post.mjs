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

const openPeriod = await db.accountingPeriod.findFirst({
  where: { orgId: org.id, status: 'OPEN' },
  select: { id: true, startDate: true, endDate: true, status: true },
  orderBy: { startDate: 'desc' },
})

const closedRecent = await db.accountingPeriod.findMany({
  where: { orgId: org.id },
  select: { startDate: true, endDate: true, status: true },
  orderBy: { startDate: 'desc' },
  take: 4,
})

const systemCogs = await db.ledgerAccount.findUnique({
  where: { orgId_systemKey: { orgId: org.id, systemKey: 'COGS' } },
  select: { code: true, name: true, _count: { select: { children: true } } },
})

const item = await db.item.findFirst({
  where: {
    orgId: org.id,
    deletedAt: null,
    isActive: true,
    availableInPos: true,
    type: 'INVENTORY',
  },
  select: {
    name: true,
    incomeAccount: { select: { code: true, name: true, _count: { select: { children: true } } } },
    cogsAccount: { select: { code: true, name: true, _count: { select: { children: true } } } },
    inventoryAccount: { select: { code: true, name: true, _count: { select: { children: true } } } },
  },
})

const lastPos = await db.posOrder.findFirst({
  where: { orgId: org.id },
  orderBy: { createdAt: 'desc' },
  select: {
    createdAt: true,
    salesDocument: { select: { number: true, total: true } },
    register: { select: { name: true } },
  },
})

const lastSale = await db.salesDocument.findFirst({
  where: { orgId: org.id, type: { in: ['SALES_RECEIPT', 'INVOICE'] } },
  orderBy: { createdAt: 'desc' },
  select: { number: true, type: true, status: true, createdAt: true, total: true },
})

console.log(
  JSON.stringify({ openPeriod, closedRecent, systemCogs, item, lastSale, lastPos }, null, 2),
)

await db.$disconnect()
