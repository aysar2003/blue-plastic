try {
  process.loadEnvFile('.env')
} catch {
  /* already set */
}

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import {
  formFamilyKey,
  parseOrgFormTemplates,
  resolveFormTemplates,
} from '../lib/form-templates.ts'

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

try {
  const org = await prisma.organization.findFirst({
    where: { name: 'AL FURAAT GROUP OF COMPANY' },
    select: { formTemplates: true },
  })
  if (!org) {
    console.error('org not found')
    process.exit(1)
  }
  const parsed = parseOrgFormTemplates(org.formTemplates)
  for (const family of [
    formFamilyKey('purchase', 'BILL'),
    formFamilyKey('sales', 'SALES_RECEIPT'),
  ]) {
    const r = resolveFormTemplates(parsed, family)
    console.log(family, {
      activeId: r.activeId,
      name: r.active.name,
      project: r.active.fields.project,
      tmplCount: r.templates.length,
      fields: r.active.fields,
      columns: r.active.columns,
    })
  }
  console.log('parse ok')
} finally {
  await prisma.$disconnect()
}
