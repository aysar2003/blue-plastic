import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

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
if (!connectionString) throw new Error('DATABASE_URL is not set.')

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const rows = await db.organization.findMany({
  select: {
    name: true,
    email: true,
    smtpHost: true,
    smtpPort: true,
    smtpSecure: true,
    smtpUser: true,
    smtpFrom: true,
    smtpPasswordSealed: true,
  },
})

for (const r of rows) {
  console.log(
    JSON.stringify({
      name: r.name,
      email: r.email,
      smtpHost: r.smtpHost,
      smtpPort: r.smtpPort,
      smtpSecure: r.smtpSecure,
      smtpUser: r.smtpUser,
      smtpFrom: r.smtpFrom,
      hasPassword: Boolean(r.smtpPasswordSealed),
      configured: Boolean(r.smtpHost && r.smtpUser && r.smtpPort && r.smtpPasswordSealed),
    }),
  )
}

await db.$disconnect()
