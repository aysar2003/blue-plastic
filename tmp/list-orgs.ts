try {
  process.loadEnvFile('.env')
} catch {
  // already loaded
}

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set.')

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

async function main() {
  const orgs = await db.organization.findMany({
    select: {
      id: true,
      name: true,
      baseCurrency: true,
      createdAt: true,
      memberships: {
        where: { role: 'OWNER', status: 'ACTIVE' },
        take: 1,
        select: { user: { select: { email: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  console.log(JSON.stringify(orgs, null, 2))
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
