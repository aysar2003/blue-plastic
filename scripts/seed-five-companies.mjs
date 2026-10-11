/**
 * Ensure five company databases exist for the system owner.
 * Copies chart + sequences from the first company so books can open.
 */
process.loadEnvFile('.env')
const { PrismaPg } = await import('@prisma/adapter-pg')
const { PrismaClient } = await import('@prisma/client')
const { randomBytes } = await import('node:crypto')

const NAMES = [
  'AL FURAAT GROUP OF COMPANY',
  'EMAAR BUILDING',
  'AL FURAAT TRADING',
  'AL FURAAT HARDWARE',
  'AL FURAAT SERVICES',
]

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const owner = await db.user.findFirst({
  where: { isSystemOwner: true },
  select: { id: true, email: true },
})
if (!owner) {
  console.error('No system owner.')
  process.exit(1)
}

const source = await db.organization.findFirst({
  orderBy: { createdAt: 'asc' },
  select: { id: true, name: true, timeZone: true },
})
if (!source) {
  console.error('No source company.')
  process.exit(1)
}

const sourceAccounts = await db.ledgerAccount.findMany({
  where: { orgId: source.id },
  orderBy: { code: 'asc' },
})
const sourceSequences = await db.documentSequence.findMany({
  where: { orgId: source.id },
})

const existing = await db.organization.findMany({ select: { name: true } })
const byName = new Set(existing.map((o) => o.name.trim().toLowerCase()))

const created = []
for (const name of NAMES) {
  if (byName.has(name.trim().toLowerCase())) {
    console.log(`exists: ${name}`)
    continue
  }

  const newOrgId = `c${randomBytes(12).toString('hex')}`
  const idMap = new Map()

  await db.$transaction(
    async (tx) => {
      await tx.organization.create({
        data: {
          id: newOrgId,
          name,
          baseCurrency: 'USD',
          fiscalYearStartMonth: 1,
          timeZone: source.timeZone || 'Africa/Mogadishu',
        },
      })

      await tx.membership.create({
        data: {
          orgId: newOrgId,
          userId: owner.id,
          role: 'OWNER',
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      })

      if (sourceSequences.length) {
        await tx.documentSequence.createMany({
          data: sourceSequences.map((seq) => ({
            orgId: newOrgId,
            docType: seq.docType,
            prefix: seq.prefix,
            nextNumber: 1,
            padding: seq.padding,
          })),
        })
      }

      // Chart without parents first, then wire hierarchy.
      const rows = sourceAccounts.map((account) => {
        const id = `c${randomBytes(12).toString('hex')}`
        idMap.set(account.id, id)
        return {
          id,
          orgId: newOrgId,
          code: account.code,
          name: account.name,
          type: account.type,
          subtype: account.subtype,
          detailType: account.detailType,
          description: account.description,
          isActive: account.isActive,
          isSystem: account.isSystem,
          systemKey: account.systemKey,
          currencyCode: account.currencyCode,
          parentId: null,
        }
      })
      if (rows.length) await tx.ledgerAccount.createMany({ data: rows })

      for (const account of sourceAccounts) {
        if (!account.parentId) continue
        const id = idMap.get(account.id)
        const parentId = idMap.get(account.parentId)
        if (id && parentId) {
          await tx.ledgerAccount.update({ where: { id }, data: { parentId } })
        }
      }

      await tx.auditLog.create({
        data: {
          orgId: newOrgId,
          actorId: owner.id,
          entity: 'Organization',
          entityId: newOrgId,
          action: 'CREATE',
          after: { name, via: 'seed-five-companies', chartFrom: source.name },
        },
      })
    },
    { maxWait: 20_000, timeout: 120_000 },
  )

  created.push(name)
  byName.add(name.trim().toLowerCase())
  console.log(`created: ${name}`)
}

const all = await db.organization.findMany({
  select: { name: true, baseCurrency: true },
  orderBy: { createdAt: 'asc' },
})
console.log(JSON.stringify({ owner: owner.email, created, total: all.length, companies: all }, null, 2))
await db.$disconnect()
