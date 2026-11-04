process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})
const users = await db.user.findMany({
  select: {
    email: true,
    name: true,
    isSystemOwner: true,
    homeOrgId: true,
    lastLoginAt: true,
    passwordHash: true,
    memberships: { select: { status: true, role: true, organization: { select: { name: true } } } },
  },
  orderBy: { createdAt: 'asc' },
})
console.log(
  JSON.stringify(
    users.map((u) => ({
      email: u.email,
      name: u.name,
      isSystemOwner: u.isSystemOwner,
      hasPassword: Boolean(u.passwordHash),
      lastLoginAt: u.lastLoginAt,
      memberships: u.memberships.map((m) => ({ org: m.organization.name, role: m.role, status: m.status })),
    })),
    null,
    2,
  ),
)
await db.$disconnect()
