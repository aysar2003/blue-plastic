/**
 * Create the least-privilege `erp_app` DB role (once) and print the DATABASE_URL
 * shape to use at runtime. Requires DIRECT_URL (or DATABASE_URL) as a superuser.
 *
 *   pnpm exec tsx scripts/create-erp-app-role.ts
 *   pnpm db:harden
 *
 * Then point runtime DATABASE_URL at erp_app (pooler) and keep DIRECT_URL as postgres.
 */
import { randomBytes } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

try {
  process.loadEnvFile('.env')
} catch {
  /* already loaded */
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.error('DIRECT_URL or DATABASE_URL is required.')
  process.exit(1)
}

const password = process.env.ERP_APP_PASSWORD?.trim() || randomBytes(24).toString('base64url')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

async function main() {
  const existing = await db.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') AS exists
  `
  if (existing[0]?.exists) {
    console.log('Role erp_app already exists. Re-run `pnpm db:harden` to refresh grants.')
    console.log('Set ERP_APP_PASSWORD only when rotating; this script will not change it.')
  } else {
    await db.$executeRawUnsafe(
      `CREATE ROLE erp_app LOGIN PASSWORD '${password.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION`,
    )
    console.log('Created role erp_app.')
    console.log(`Password (save now): ${password}`)
  }

  const hostMatch = connectionString.match(/@([^/]+)\//)
  const host = hostMatch?.[1] ?? 'HOST:6543'
  console.log('\nNext steps:')
  console.log('  1. pnpm db:harden')
  console.log(
    `  2. Runtime DATABASE_URL=postgresql://erp_app:PASSWORD@${host.replace(':5432', ':6543')}/postgres?pgbouncer=true&sslmode=require`,
  )
  console.log('  3. Keep DIRECT_URL as the postgres/superuser URL for migrations only.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
