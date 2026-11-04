process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})
const rows = await db.user.findMany({
  where: { email: { in: ['aysaryare@gmail.com', 'deeqa@gmail.com'] } },
  select: {
    email: true,
    isSystemOwner: true,
    totpEnabledAt: true,
    otp2faEnabledAt: true,
    memberships: { select: { role: true, status: true, organization: { select: { name: true } } } },
  },
})
console.log(
  JSON.stringify(
    rows.map((u) => ({
      email: u.email,
      isSystemOwner: u.isSystemOwner,
      totp: Boolean(u.totpEnabledAt),
      otp: Boolean(u.otp2faEnabledAt),
      memberships: u.memberships,
    })),
    null,
    2,
  ),
)
await db.$disconnect()
