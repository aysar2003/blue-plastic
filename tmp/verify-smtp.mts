import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import nodemailer from 'nodemailer'
import { openSecret } from '../lib/sealed-secret.ts'

try {
  process.loadEnvFile('.env')
} catch {
  /* ignore */
}
try {
  process.loadEnvFile('.env.local')
} catch {
  /* ignore */
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
if (!connectionString) throw new Error('DATABASE_URL is not set.')
if (!authSecret) throw new Error('AUTH_SECRET is not set.')

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const org = await db.organization.findFirst({
  where: { smtpUser: 'aysaryare@gmail.com' },
  select: {
    name: true,
    smtpHost: true,
    smtpPort: true,
    smtpSecure: true,
    smtpUser: true,
    smtpFrom: true,
    smtpPasswordSealed: true,
  },
})

if (!org?.smtpHost || !org.smtpPort || !org.smtpUser || !org.smtpPasswordSealed) {
  console.log('NOT_CONFIGURED')
  await db.$disconnect()
  process.exit(1)
}

const password = openSecret(org.smtpPasswordSealed, authSecret)
if (!password) {
  console.log('PASSWORD_UNSEAL_FAILED')
  await db.$disconnect()
  process.exit(1)
}

const transport = nodemailer.createTransport({
  host: org.smtpHost,
  port: org.smtpPort,
  secure: org.smtpSecure,
  auth: { user: org.smtpUser, pass: password },
})

try {
  await transport.verify()
  console.log(
    JSON.stringify({
      ok: true,
      company: org.name,
      from: org.smtpFrom ?? org.smtpUser,
      host: org.smtpHost,
      port: org.smtpPort,
    }),
  )
} catch (error) {
  console.log(
    JSON.stringify({
      ok: false,
      company: org.name,
      from: org.smtpFrom ?? org.smtpUser,
      error: error instanceof Error ? error.message : String(error),
    }),
  )
  await db.$disconnect()
  process.exit(1)
}

await db.$disconnect()
