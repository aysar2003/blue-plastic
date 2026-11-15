/**
 * Move system COGS role from heading 5000 onto leaf 5005 Merchandise
 * so sales/POS that fall back to the system binding can post.
 */
process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const ORG_NAME = 'AL FURAAT GROUP OF COMPANY'
const LEAF_CODE = '5005'

const org = await db.organization.findFirst({
  where: { name: { equals: ORG_NAME, mode: 'insensitive' } },
  select: { id: true, name: true },
})
if (!org) {
  console.error('Org not found')
  process.exit(1)
}

const previous = await db.ledgerAccount.findUnique({
  where: { orgId_systemKey: { orgId: org.id, systemKey: 'COGS' } },
  select: { id: true, code: true, name: true, _count: { select: { children: true } } },
})

const leaf = await db.ledgerAccount.findFirst({
  where: { orgId: org.id, code: LEAF_CODE, type: 'COGS', isActive: true },
  select: { id: true, code: true, name: true, _count: { select: { children: true } } },
})

if (!leaf) {
  console.error(`Leaf ${LEAF_CODE} not found`)
  process.exit(1)
}
if (leaf._count.children > 0) {
  console.error(`${leaf.code} still has children — refuse to bind`)
  process.exit(1)
}

if (previous?.id === leaf.id) {
  console.log(JSON.stringify({ ok: true, already: true, leaf }, null, 2))
  await db.$disconnect()
  process.exit(0)
}

await db.$transaction(async (tx) => {
  if (previous) {
    await tx.ledgerAccount.update({
      where: { id: previous.id },
      data: { systemKey: null, isSystem: false },
    })
  }
  await tx.ledgerAccount.update({
    where: { id: leaf.id },
    data: { systemKey: 'COGS', isSystem: true },
  })
})

const now = await db.ledgerAccount.findUnique({
  where: { orgId_systemKey: { orgId: org.id, systemKey: 'COGS' } },
  select: { id: true, code: true, name: true, _count: { select: { children: true } } },
})

console.log(
  JSON.stringify(
    {
      ok: true,
      org: org.name,
      previous: previous
        ? { code: previous.code, name: previous.name, children: previous._count.children }
        : null,
      now: now
        ? { code: now.code, name: now.name, children: now._count.children }
        : null,
    },
    null,
    2,
  ),
)

await db.$disconnect()
