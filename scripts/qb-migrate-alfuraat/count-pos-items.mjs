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

const active = await db.item.count({
  where: { orgId: org.id, deletedAt: null, isActive: true },
})
const inPos = await db.item.count({
  where: { orgId: org.id, deletedAt: null, isActive: true, availableInPos: true },
})
const trackedInPos = await db.item.count({
  where: {
    orgId: org.id,
    deletedAt: null,
    isActive: true,
    availableInPos: true,
    type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
  },
})
const noPrice = await db.item.count({
  where: {
    orgId: org.id,
    deletedAt: null,
    isActive: true,
    availableInPos: true,
    OR: [{ salesPrice: null }, { salesPrice: 0 }],
  },
})

console.log({ active, inPos, trackedInPos, noPrice })
await db.$disconnect()
