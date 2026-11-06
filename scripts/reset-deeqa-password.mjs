process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const email = 'deeqa@gmail.com'
const password = 'Deeqa2026!'
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})
const user = await db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
if (!user) {
  console.error('user not found')
  process.exit(1)
}
const passwordHash = await bcrypt.hash(password, 12)
await db.user.update({ where: { id: user.id }, data: { passwordHash } })
const memberships = await db.membership.findMany({
  where: { userId: user.id },
  include: { organization: { select: { name: true } } },
})
console.log(
  JSON.stringify(
    {
      id: user.id,
      email: user.email,
      memberships: memberships.map((m) => ({ org: m.organization.name, role: m.role, status: m.status })),
    },
    null,
    2,
  ),
)
await db.$disconnect()
