/**
 * One-shot: confirm Organization.formTemplates exists and parses.
 * Run: pnpm exec tsx tmp/check-form-templates.mts
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

try {
  process.loadEnvFile('.env')
} catch {
  // Environment already populated.
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

try {
  const cols = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'formTemplates'
  `
  console.log('column:', cols)

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, formTemplates: true },
    take: 5,
  })
  for (const org of orgs) {
    const raw = org.formTemplates
    const ok = raw === null || (typeof raw === 'object' && !Array.isArray(raw))
    console.log({
      id: org.id,
      name: org.name,
      formTemplatesType: raw === null ? 'null' : typeof raw,
      parseOk: ok,
      preview: raw,
    })
  }
  console.log('ok', orgs.length, 'orgs')
} finally {
  await prisma.$disconnect()
}
