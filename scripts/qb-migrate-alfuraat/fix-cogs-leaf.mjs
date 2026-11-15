/**
 * AL FURAAT GROUP: inventory items point at COGS heading 5000, which has
 * multiple ADJ children — sales posting refuses ambiguous headings.
 * Add a Merchandise leaf under 5000 and remap items that used the heading.
 */
process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const ORG_NAME = 'AL FURAAT GROUP OF COMPANY'
const LEAF_CODE = '5005'
const LEAF_NAME = 'Merchandise'

const org = await db.organization.findFirst({
  where: { name: { equals: ORG_NAME, mode: 'insensitive' } },
  select: { id: true, name: true },
})
if (!org) {
  console.error(`Org not found: ${ORG_NAME}`)
  process.exit(1)
}

const heading = await db.ledgerAccount.findFirst({
  where: { orgId: org.id, systemKey: 'COGS' },
  select: {
    id: true,
    code: true,
    name: true,
    type: true,
    subtype: true,
    _count: { select: { children: true } },
  },
})
if (!heading) {
  console.error('No system COGS account on this org.')
  process.exit(1)
}

let leaf = await db.ledgerAccount.findFirst({
  where: { orgId: org.id, code: LEAF_CODE },
  select: { id: true, code: true, name: true, parentId: true, type: true },
})

if (!leaf) {
  leaf = await db.ledgerAccount.create({
    data: {
      orgId: org.id,
      code: LEAF_CODE,
      name: LEAF_NAME,
      type: 'COGS',
      subtype: heading.subtype,
      parentId: heading.id,
      isActive: true,
    },
    select: { id: true, code: true, name: true, parentId: true, type: true },
  })
  console.log(`Created ${leaf.code} ${leaf.name} under ${heading.code}`)
} else {
  console.log(`Using existing ${leaf.code} ${leaf.name}`)
}

const updated = await db.item.updateMany({
  where: {
    orgId: org.id,
    cogsAccountId: heading.id,
    type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
  },
  data: { cogsAccountId: leaf.id },
})

console.log(
  JSON.stringify(
    {
      org: org.name,
      heading: { id: heading.id, code: heading.code, children: heading._count.children },
      leaf: { id: leaf.id, code: leaf.code, name: leaf.name },
      itemsRemapped: updated.count,
    },
    null,
    2,
  ),
)

await db.$disconnect()
