process.loadEnvFile('.env')
const { PrismaPg } = await import('@prisma/adapter-pg')
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})
const id = 'cmvezuwzw000507l8ewxbhc15'
const out = {
  customers: await db.customer.count({ where: { orgId: id } }),
  vendors: await db.vendor.count({ where: { orgId: id } }),
  items: await db.item.count({ where: { orgId: id } }),
  invoices: await db.salesDocument.count({ where: { orgId: id, type: 'INVOICE' } }),
  bills: await db.purchaseDocument.count({ where: { orgId: id, type: 'BILL' } }),
  journals: await db.journal.count({ where: { orgId: id } }),
  accounts: await db.ledgerAccount.count({ where: { orgId: id } }),
  memberships: await db.membership.count({ where: { orgId: id } }),
}
console.log(JSON.stringify(out))
await db.$disconnect()
