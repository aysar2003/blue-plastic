/**
 * One-shot: enable Employees for AL FURAAT / AFG companies.
 * Run: pnpm exec tsx scripts/enable-employees-afg.ts
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { parseFeatureFlags } from '../lib/feature-flags'

try {
  process.loadEnvFile('.env')
} catch {
  // Environment already populated.
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

async function main() {
  let orgs = await db.organization.findMany({
    where: {
      OR: [
        { name: { contains: 'FURAAT', mode: 'insensitive' } },
        { name: { contains: 'AFG', mode: 'insensitive' } },
        { brandMark: { equals: 'AFG', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, featureFlags: true },
  })

  if (orgs.length === 0) {
    console.log('No AFG/FURAAT org found — enabling for all orgs.')
    orgs = await db.organization.findMany({
      select: { id: true, name: true, featureFlags: true },
    })
  }

  for (const org of orgs) {
    const flags = parseFeatureFlags(org.featureFlags)
    flags.grantedModules.employees = true
    flags.modules.employees = true
    await db.organization.update({
      where: { id: org.id },
      data: { featureFlags: flags },
    })
    console.log(`Enabled Employees for: ${org.name} (${org.id})`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
