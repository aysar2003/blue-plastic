process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const email = 'live-staff@som-erp.app'
const password = 'LiveStaff2026!'
const existing = await db.user.findUnique({ where: { email } })
const passwordHash = await bcrypt.hash(password, 12)

if (existing) {
  await db.user.update({
    where: { id: existing.id },
    data: { passwordHash, isSystemOwner: true, emailVerified: new Date() },
  })
} else {
  await db.user.create({
    data: {
      email,
      name: 'Live Staff',
      passwordHash,
      isSystemOwner: true,
      emailVerified: new Date(),
    },
  })
}

const user = await db.user.findUnique({
  where: { email },
  select: { email: true, isSystemOwner: true, totpEnabledAt: true, otp2faEnabledAt: true },
})
console.log(
  JSON.stringify(
    {
      email: user.email,
      password,
      isSystemOwner: user.isSystemOwner,
      totp: Boolean(user.totpEnabledAt),
      otp: Boolean(user.otp2faEnabledAt),
      door: '/login/staff',
    },
    null,
    2,
  ),
)
await db.$disconnect()
