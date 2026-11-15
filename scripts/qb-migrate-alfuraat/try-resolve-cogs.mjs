process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { resolvePostableCogsAccountId } from '../../server/accounting/chart-of-accounts.ts'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const org = await db.organization.findFirst({
  where: { name: { equals: 'AL FURAAT GROUP OF COMPANY', mode: 'insensitive' } },
  select: { id: true },
})

const leaf = await db.ledgerAccount.findFirst({
  where: { orgId: org.id, code: '5005' },
  select: { id: true, code: true },
})
const heading = await db.ledgerAccount.findUnique({
  where: { orgId_systemKey: { orgId: org.id, systemKey: 'COGS' } },
  select: { id: true, code: true },
})

const sample = await db.item.findFirst({
  where: {
    orgId: org.id,
    deletedAt: null,
    isActive: true,
    type: 'INVENTORY',
    availableInPos: true,
  },
  select: {
    id: true,
    name: true,
    cogsAccountId: true,
    incomeAccountId: true,
    inventoryAccountId: true,
  },
})

console.log({ sample, leaf, heading })

try {
  const withLeaf = await resolvePostableCogsAccountId(db, org.id, leaf.id)
  console.log('resolve leaf ok', withLeaf)
} catch (e) {
  console.log('resolve leaf FAIL', e?.message || e)
}

try {
  const withHeading = await resolvePostableCogsAccountId(db, org.id, heading.id)
  console.log('resolve heading ok', withHeading)
} catch (e) {
  console.log('resolve heading FAIL', e?.message || e)
}

try {
  const withNull = await resolvePostableCogsAccountId(db, org.id, null)
  console.log('resolve null ok', withNull)
} catch (e) {
  console.log('resolve null FAIL', e?.message || e)
}

await db.$disconnect()
