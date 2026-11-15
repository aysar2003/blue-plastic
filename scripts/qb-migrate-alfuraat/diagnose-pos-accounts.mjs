process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const org = await db.organization.findFirst({
  where: { name: { equals: 'AL FURAAT GROUP OF COMPANY', mode: 'insensitive' } },
  select: { id: true, name: true },
})

const registers = await db.posRegister.findMany({
  where: { orgId: org.id },
  select: {
    id: true,
    name: true,
    isActive: true,
    store: { select: { name: true } },
    account: {
      select: {
        code: true,
        name: true,
        _count: { select: { children: true } },
      },
    },
  },
})

const methods = await db.posPaymentMethod.findMany({
  where: { orgId: org.id },
  select: {
    name: true,
    isActive: true,
    account: {
      select: {
        code: true,
        name: true,
        _count: { select: { children: true } },
      },
    },
  },
  orderBy: { name: 'asc' },
})

const openSessions = await db.posSession.findMany({
  where: { orgId: org.id, status: 'OPEN' },
  select: {
    id: true,
    openedAt: true,
    register: { select: { name: true } },
  },
  take: 10,
})

const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
const recentPosOrders = await db.posOrder.count({
  where: { orgId: org.id, createdAt: { gte: since } },
})
const recentSales = await db.salesDocument.count({
  where: {
    orgId: org.id,
    type: { in: ['SALES_RECEIPT', 'INVOICE'] },
    createdAt: { gte: since },
    deletedAt: null,
  },
})

// Income accounts on POS-available items — any non-REVENUE or heading?
const posItems = await db.item.findMany({
  where: {
    orgId: org.id,
    deletedAt: null,
    isActive: true,
    availableInPos: true,
  },
  select: {
    name: true,
    type: true,
    incomeAccount: {
      select: {
        code: true,
        name: true,
        type: true,
        _count: { select: { children: true } },
      },
    },
    cogsAccount: {
      select: {
        code: true,
        name: true,
        type: true,
        _count: { select: { children: true } },
      },
    },
    inventoryAccount: {
      select: {
        code: true,
        name: true,
        type: true,
        _count: { select: { children: true } },
      },
    },
  },
  take: 50,
})

const badPosItems = posItems.filter((item) => {
  const incomeBad =
    !item.incomeAccount ||
    item.incomeAccount._count.children > 0 ||
    (item.incomeAccount.type !== 'REVENUE' && item.type !== 'PAYMENT' && item.type !== 'DISCOUNT')
  const cogsBad =
    (item.type === 'INVENTORY' || item.type === 'INVENTORY_ASSEMBLY') &&
    (!item.cogsAccount || item.cogsAccount._count.children > 0 || item.cogsAccount.type !== 'COGS')
  const invBad =
    (item.type === 'INVENTORY' || item.type === 'INVENTORY_ASSEMBLY') &&
    (!item.inventoryAccount || item.inventoryAccount._count.children > 0)
  return incomeBad || cogsBad || invBad
})

console.log(
  JSON.stringify(
    {
      org: org.name,
      registers: registers.map((r) => ({
        name: r.name,
        active: r.isActive,
        store: r.store?.name ?? null,
        account: r.account
          ? {
              code: r.account.code,
              name: r.account.name,
              isHeading: r.account._count.children > 0,
            }
          : null,
      })),
      methods: methods.map((m) => ({
        name: m.name,
        active: m.isActive,
        account: m.account
          ? {
              code: m.account.code,
              name: m.account.name,
              isHeading: m.account._count.children > 0,
            }
          : null,
      })),
      openSessions,
      recentPosOrders3d: recentPosOrders,
      recentSales3d: recentSales,
      posItemsSampleChecked: posItems.length,
      badPosItemsSample: badPosItems.slice(0, 15).map((i) => ({
        name: i.name,
        type: i.type,
        income: i.incomeAccount,
        cogs: i.cogsAccount,
        inventory: i.inventoryAccount,
      })),
      badPosItemsCountInSample: badPosItems.length,
    },
    null,
    2,
  ),
)

await db.$disconnect()
