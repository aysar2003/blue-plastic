process.loadEnvFile('.env')
const { PrismaPg } = await import('@prisma/adapter-pg')
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})
const orgs = await db.organization.findMany({
  select: {
    id: true,
    name: true,
    brandMark: true,
    baseCurrency: true,
    allowNegativeStock: true,
    _count: {
      select: {
        customers: true,
        vendors: true,
        items: true,
        salesDocuments: true,
        purchaseDocuments: true,
        journals: true,
      },
    },
  },
  orderBy: { name: 'asc' },
})
console.log(JSON.stringify(orgs, null, 2))
await db.$disconnect()
