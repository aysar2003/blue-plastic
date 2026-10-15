/**
 * Smoke: create + read a Projects job for AFG / AL FURAAT.
 * Run: pnpm exec tsx scripts/smoke-projects-afg.ts
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

try {
  process.loadEnvFile('.env')
} catch {
  // Environment already populated.
}
try {
  process.loadEnvFile('.env.local')
} catch {
  // Optional overrides.
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

async function nextProjectNumber(orgId: string) {
  const rows = await db.$queryRaw<{ prefix: string; allocated: number; padding: number }[]>`
    UPDATE document_sequences
       SET "nextNumber" = "nextNumber" + 1,
           "updatedAt"  = now()
     WHERE "orgId"   = ${orgId}
       AND "docType" = 'PROJECT'::"DocumentType"
    RETURNING prefix, "nextNumber" - 1 AS allocated, padding
  `
  if (rows.length > 0) {
    const { prefix, allocated, padding } = rows[0]
    return `${prefix}${String(Number(allocated)).padStart(padding, '0')}`
  }
  await db.documentSequence.create({
    data: { orgId, docType: 'PROJECT', prefix: 'PRJ-', nextNumber: 2, padding: 5 },
  })
  return 'PRJ-00001'
}

async function main() {
  const orgs = await db.organization.findMany({
    where: {
      OR: [
        { name: { contains: 'FURAAT', mode: 'insensitive' } },
        { name: { contains: 'AFG', mode: 'insensitive' } },
        { brandMark: { equals: 'AFG', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      _count: { select: { customers: true } },
    },
    orderBy: { name: 'asc' },
  })
  const org =
    orgs.find((row) => /group/i.test(row.name) && row._count.customers > 0) ??
    orgs.find((row) => row._count.customers > 0) ??
    orgs[0]
  if (!org) {
    console.error('No AFG / AL FURAAT organisation found.')
    process.exit(1)
  }

  const customer = await db.customer.findFirst({
    where: { orgId: org.id, isActive: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: 'asc' },
  })
  if (!customer) {
    console.error(`No customer on ${org.name}.`)
    process.exit(1)
  }

  const number = await nextProjectNumber(org.id)
  const project = await db.project.create({
    data: {
      orgId: org.id,
      number,
      name: `Smoke job ${number}`,
      customerId: customer.id,
      siteLocation: 'Smoke site',
      status: 'ACTIVE',
      description: 'Created by smoke-projects-afg.ts',
    },
    select: { id: true, number: true, name: true, status: true },
  })

  const counted = await db.project.count({ where: { orgId: org.id } })
  const linkedSales = await db.salesDocument.count({
    where: { orgId: org.id, projectId: project.id },
  })

  console.log(`Org: ${org.name}`)
  console.log(`Customer: ${customer.displayName}`)
  console.log(`Created: ${project.number} (${project.id}) status=${project.status}`)
  console.log(`Projects on org: ${counted}`)
  console.log(`Linked sales: ${linkedSales}`)
  console.log(`Detail URL: /projects/${project.id}`)
  console.log('OK')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
