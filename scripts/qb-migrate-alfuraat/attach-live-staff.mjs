process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const user = await db.user.findUnique({ where: { email: 'live-staff@som-erp.app' } })
const org = await db.organization.findFirst({
  where: { name: { equals: 'AL FURAAT MATERIALS', mode: 'insensitive' } },
  select: { id: true, name: true },
})
if (!user || !org) {
  console.log(JSON.stringify({ user: Boolean(user), org }))
  await db.$disconnect()
  process.exit(1)
}

await db.membership.upsert({
  where: { orgId_userId: { orgId: org.id, userId: user.id } },
  create: {
    orgId: org.id,
    userId: user.id,
    role: 'OWNER',
    status: 'ACTIVE',
    canConnect: true,
    acceptedAt: new Date(),
  },
  update: { role: 'OWNER', status: 'ACTIVE', canConnect: true, acceptedAt: new Date() },
})
await db.user.update({
  where: { id: user.id },
  data: { homeOrgId: org.id, isSystemOwner: true },
})

const check = await db.user.findUnique({
  where: { id: user.id },
  select: {
    email: true,
    isSystemOwner: true,
    homeOrgId: true,
    memberships: { select: { role: true, status: true, canConnect: true, organization: { select: { name: true } } } },
  },
})
console.log(JSON.stringify(check, null, 2))
await db.$disconnect()
