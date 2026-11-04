process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const owner = await db.user.findFirst({
  where: { email: { equals: 'aysaryare@gmail.com', mode: 'insensitive' } },
  select: {
    id: true,
    email: true,
    isSystemOwner: true,
    totpEnabledAt: true,
    otp2faEnabledAt: true,
    homeOrgId: true,
  },
})
const deeqa = await db.user.findFirst({
  where: { email: { equals: 'deeqa@gmail.com', mode: 'insensitive' } },
  select: { id: true, email: true, isSystemOwner: true, totpEnabledAt: true, otp2faEnabledAt: true },
})

const staffPass = 'LiveStaff2026!'
const companyPass = 'Deeqa2026!'
await db.user.update({
  where: { id: owner.id },
  data: { passwordHash: await bcrypt.hash(staffPass, 12) },
})
await db.user.update({
  where: { id: deeqa.id },
  data: { passwordHash: await bcrypt.hash(companyPass, 12) },
})
console.log(
  JSON.stringify(
    {
      staff: {
        email: owner.email,
        isSystemOwner: owner.isSystemOwner,
        totp: Boolean(owner.totpEnabledAt),
        otp: Boolean(owner.otp2faEnabledAt),
        password: staffPass,
        door: '/login/staff',
      },
      company: {
        email: deeqa.email,
        isSystemOwner: deeqa.isSystemOwner,
        totp: Boolean(deeqa.totpEnabledAt),
        otp: Boolean(deeqa.otp2faEnabledAt),
        password: companyPass,
        door: '/login/company',
        org: 'AL FURAAT MATERIALS',
      },
    },
    null,
    2,
  ),
)
await db.$disconnect()
