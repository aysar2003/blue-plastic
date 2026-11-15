/** Apply protect_system_accounts rebind flag, then move COGS → 5005 Merchandise. */
process.loadEnvFile('.env')
import { readFileSync } from 'node:fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const sql = readFileSync(
  new URL('../../prisma/migrations/20261114210000_allow_system_account_rebind/migration.sql', import.meta.url),
  'utf8',
)
await db.$executeRawUnsafe(sql)
console.log('trigger updated')

const org = await db.organization.findFirst({
  where: { name: { equals: 'AL FURAAT GROUP OF COMPANY', mode: 'insensitive' } },
  select: { id: true },
})
const leaf = await db.ledgerAccount.findFirst({
  where: { orgId: org.id, code: '5005', type: 'COGS' },
  select: { id: true, code: true, name: true },
})
const previous = await db.ledgerAccount.findUnique({
  where: { orgId_systemKey: { orgId: org.id, systemKey: 'COGS' } },
  select: { id: true, code: true, name: true },
})

if (previous?.id === leaf.id) {
  console.log('already on', leaf)
} else {
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.allow_system_rebind', 'on', true)`)
    if (previous) {
      await tx.ledgerAccount.update({
        where: { id: previous.id },
        data: { systemKey: null, isSystem: false },
      })
    }
    await tx.ledgerAccount.update({
      where: { id: leaf.id },
      data: { systemKey: 'COGS', isSystem: true },
    })
  })
  const now = await db.ledgerAccount.findUnique({
    where: { orgId_systemKey: { orgId: org.id, systemKey: 'COGS' } },
    select: { code: true, name: true },
  })
  console.log({ previous: previous?.code, now })
}

await db.$disconnect()
