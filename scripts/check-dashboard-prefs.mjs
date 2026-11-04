process.loadEnvFile('.env')
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})
const row = await db.user.findFirst({ select: { id: true, email: true, dashboardPrefs: true } })
console.log('ok', row)
await db.$disconnect()
