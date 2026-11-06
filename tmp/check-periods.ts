try {
  process.loadEnvFile('.env')
} catch {
  /* */
}
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! }),
})

async function main() {
  const org = await db.organization.findFirst({
    where: { name: { equals: 'Tijaabo Trading', mode: 'insensitive' } },
    select: { id: true },
  })
  if (!org) throw new Error('org missing')
  const periods = await db.accountingPeriod.findMany({
    where: { orgId: org.id, fiscalYear: { year: 2025 } },
    orderBy: { periodNumber: 'asc' },
    select: { periodNumber: true, status: true },
  })
  const year = await db.fiscalYear.findFirst({
    where: { orgId: org.id, year: 2025 },
    select: { status: true, closingJournalId: true },
  })
  console.log(JSON.stringify({ year, periods }, null, 2))
}

main()
  .finally(() => db.$disconnect())
