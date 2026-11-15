/**
 * Show why AL FURAAT POS/sales refuse: items bound to COGS/income/inventory headings.
 */
process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const ORG_NAME = 'AL FURAAT GROUP OF COMPANY'

const org = await db.organization.findFirst({
  where: { name: { equals: ORG_NAME, mode: 'insensitive' } },
  select: { id: true, name: true },
})
if (!org) {
  console.error('NO_ORG')
  process.exit(1)
}

const cogs = await db.ledgerAccount.findUnique({
  where: { orgId_systemKey: { orgId: org.id, systemKey: 'COGS' } },
  select: {
    id: true,
    code: true,
    name: true,
    _count: { select: { children: true } },
  },
})

const children = cogs
  ? await db.ledgerAccount.findMany({
      where: { orgId: org.id, parentId: cogs.id, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        _count: { select: { children: true } },
      },
      orderBy: { code: 'asc' },
    })
  : []

const itemsOnCogsHeading = cogs
  ? await db.item.count({
      where: {
        orgId: org.id,
        deletedAt: null,
        cogsAccountId: cogs.id,
        type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
      },
    })
  : 0

const revenueAccounts = await db.ledgerAccount.findMany({
  where: { orgId: org.id, isActive: true, type: 'REVENUE' },
  select: {
    id: true,
    code: true,
    name: true,
    systemKey: true,
    _count: { select: { children: true } },
  },
})
const badIncome = revenueAccounts.filter((a) => a._count.children > 0)
const itemsOnIncomeHeading = badIncome.length
  ? await db.item.count({
      where: {
        orgId: org.id,
        deletedAt: null,
        incomeAccountId: { in: badIncome.map((a) => a.id) },
      },
    })
  : 0

const assetAccounts = await db.ledgerAccount.findMany({
  where: { orgId: org.id, isActive: true, type: 'ASSET' },
  select: {
    id: true,
    code: true,
    name: true,
    systemKey: true,
    _count: { select: { children: true } },
  },
})
const badInv = assetAccounts.filter((a) => a._count.children > 0)
const itemsOnInvHeading = badInv.length
  ? await db.item.count({
      where: {
        orgId: org.id,
        deletedAt: null,
        inventoryAccountId: { in: badInv.map((a) => a.id) },
      },
    })
  : 0

const sample = cogs
  ? await db.item.findMany({
      where: {
        orgId: org.id,
        deletedAt: null,
        cogsAccountId: cogs.id,
        type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
      },
      select: { name: true, sku: true, type: true },
      take: 10,
      orderBy: { name: 'asc' },
    })
  : []

const systemBindings = await db.ledgerAccount.findMany({
  where: {
    orgId: org.id,
    systemKey: { not: null },
    isActive: true,
  },
  select: {
    systemKey: true,
    code: true,
    name: true,
    _count: { select: { children: true } },
  },
})
const headingBindings = systemBindings.filter((a) => a._count.children > 0)

console.log(
  JSON.stringify(
    {
      org,
      cogs,
      children,
      itemsOnCogsHeading,
      itemsOnIncomeHeading,
      badIncome: badIncome.map((a) => ({
        code: a.code,
        name: a.name,
        children: a._count.children,
        systemKey: a.systemKey,
      })),
      itemsOnInvHeading,
      badInv: badInv
        .filter((a) => a.systemKey === 'INVENTORY' || a._count.children > 0)
        .slice(0, 15)
        .map((a) => ({
          code: a.code,
          name: a.name,
          children: a._count.children,
          systemKey: a.systemKey,
        })),
      headingSystemBindings: headingBindings,
      sampleItemsOnCogsHeading: sample,
    },
    null,
    2,
  ),
)

await db.$disconnect()
