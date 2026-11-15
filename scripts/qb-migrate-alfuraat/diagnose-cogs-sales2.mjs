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

const cogsHeadingId = 'cmupoku2w000mrsvryutldmkg'
const leafId = 'cmwf6u56h0000qovrtsz76y1o'

const byType = await db.item.groupBy({
  by: ['type'],
  where: { orgId: org.id, deletedAt: null, isActive: true },
  _count: true,
})

const trackedNullCogs = await db.item.count({
  where: {
    orgId: org.id,
    deletedAt: null,
    isActive: true,
    type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
    OR: [{ cogsAccountId: null }, { cogsAccountId: cogsHeadingId }],
  },
})

const trackedOnLeaf = await db.item.count({
  where: {
    orgId: org.id,
    deletedAt: null,
    isActive: true,
    type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
    cogsAccountId: leafId,
  },
})

const trackedOtherCogs = await db.item.findMany({
  where: {
    orgId: org.id,
    deletedAt: null,
    isActive: true,
    type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
    cogsAccountId: { not: null, notIn: [leafId, cogsHeadingId] },
  },
  select: {
    name: true,
    cogsAccount: { select: { code: true, name: true, _count: { select: { children: true } } } },
  },
  take: 20,
})

const nullIncome = await db.item.count({
  where: {
    orgId: org.id,
    deletedAt: null,
    isActive: true,
    availableInPos: true,
    type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY', 'NON_INVENTORY', 'SERVICE'] },
    incomeAccountId: null,
  },
})

const nullInventory = await db.item.count({
  where: {
    orgId: org.id,
    deletedAt: null,
    isActive: true,
    type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
    inventoryAccountId: null,
  },
})

const incomeAccountsUsed = await db.item.groupBy({
  by: ['incomeAccountId'],
  where: {
    orgId: org.id,
    deletedAt: null,
    isActive: true,
    availableInPos: true,
    incomeAccountId: { not: null },
  },
  _count: true,
})

const incomeIds = incomeAccountsUsed.map((r) => r.incomeAccountId).filter(Boolean)
const incomeRows = incomeIds.length
  ? await db.ledgerAccount.findMany({
      where: { id: { in: incomeIds } },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        _count: { select: { children: true } },
      },
    })
  : []
const incomeHeadingHits = incomeRows
  .filter((a) => a._count.children > 0)
  .map((a) => ({
    ...a,
    items: incomeAccountsUsed.find((r) => r.incomeAccountId === a.id)?._count ?? 0,
  }))

const invAccountsUsed = await db.item.groupBy({
  by: ['inventoryAccountId'],
  where: {
    orgId: org.id,
    deletedAt: null,
    isActive: true,
    type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
    inventoryAccountId: { not: null },
  },
  _count: true,
})
const invIds = invAccountsUsed.map((r) => r.inventoryAccountId).filter(Boolean)
const invRows = invIds.length
  ? await db.ledgerAccount.findMany({
      where: { id: { in: invIds } },
      select: {
        id: true,
        code: true,
        name: true,
        _count: { select: { children: true } },
      },
    })
  : []
const invHeadingHits = invRows
  .filter((a) => a._count.children > 0)
  .map((a) => ({
    code: a.code,
    name: a.name,
    children: a._count.children,
    items: invAccountsUsed.find((r) => r.inventoryAccountId === a.id)?._count ?? 0,
  }))

const uncategorised = await db.ledgerAccount.findUnique({
  where: { orgId_systemKey: { orgId: org.id, systemKey: 'UNCATEGORISED_INCOME' } },
  select: {
    id: true,
    code: true,
    name: true,
    _count: { select: { children: true } },
  },
})

console.log(
  JSON.stringify(
    {
      byType,
      trackedNullOrHeadingCogs: trackedNullCogs,
      trackedOnMerchandiseLeaf: trackedOnLeaf,
      trackedOtherCogsSample: trackedOtherCogs,
      posItemsNullIncome: nullIncome,
      trackedNullInventory: nullInventory,
      incomeHeadingHits,
      invHeadingHits,
      uncategorisedIncome: uncategorised,
    },
    null,
    2,
  ),
)

await db.$disconnect()
