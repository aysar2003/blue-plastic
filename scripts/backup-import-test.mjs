/**
 * Backup the primary company and import it as a separate test company.
 * Self-contained (no server-only imports).
 */
process.loadEnvFile('.env')
const { writeFileSync } = await import('node:fs')
const { join } = await import('node:path')
const { randomBytes } = await import('node:crypto')
const { PrismaPg } = await import('@prisma/adapter-pg')
const { PrismaClient } = await import('@prisma/client')

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const newId = () => `c${randomBytes(12).toString('hex')}`

const owner = await db.user.findFirst({
  where: { isSystemOwner: true },
  select: { id: true, email: true },
})
if (!owner) throw new Error('No system owner')

const source = await db.organization.findFirst({
  where: { name: 'AL FURAAT GROUP OF COMPANY' },
})
if (!source) throw new Error('Source company missing')

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
const testName = `AL FURAAT TEST RESTORE ${stamp}`

console.log(`Backing up ${source.name} → import as ${testName}`)

const [
  sequences,
  accounts,
  fiscalYears,
  periods,
  paymentTerms,
  customers,
  vendors,
  itemCategories,
  items,
  taxAgencies,
  taxRates,
  taxCodes,
] = await Promise.all([
  db.documentSequence.findMany({ where: { orgId: source.id } }),
  db.ledgerAccount.findMany({ where: { orgId: source.id }, orderBy: { code: 'asc' } }),
  db.fiscalYear.findMany({ where: { orgId: source.id } }),
  db.accountingPeriod.findMany({ where: { orgId: source.id } }),
  db.paymentTerm.findMany({ where: { orgId: source.id } }),
  db.customer.findMany({ where: { orgId: source.id } }),
  db.vendor.findMany({ where: { orgId: source.id } }),
  db.itemCategory.findMany({ where: { orgId: source.id } }),
  db.item.findMany({ where: { orgId: source.id } }),
  db.taxAgency.findMany({ where: { orgId: source.id } }),
  db.taxRate.findMany({ where: { orgId: source.id } }),
  db.taxCode.findMany({ where: { orgId: source.id } }),
])

const backup = {
  version: 1,
  takenAt: new Date().toISOString(),
  organization: source,
  sequences,
  accounts,
  fiscalYears,
  periods,
  paymentTerms,
  customers,
  vendors,
  itemCategories,
  items,
  taxAgencies,
  taxRates,
  taxCodes,
  memberships: [],
}

const outPath = join(process.cwd(), '.tmp-alfuraat-backup.json')
writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf8')
console.log(`Wrote ${outPath} (${Math.round(JSON.stringify(backup).length / 1024)} KB)`)

const idMap = new Map()
const map = (old) => {
  if (old == null || old === '') return null
  const key = String(old)
  let next = idMap.get(key)
  if (!next) {
    next = newId()
    idMap.set(key, next)
  }
  return next
}

const newOrgId = newId()
idMap.set(source.id, newOrgId)

await db.$transaction(
  async (tx) => {
    await tx.organization.create({
      data: {
        id: newOrgId,
        name: testName,
        legalName: source.legalName,
        baseCurrency: source.baseCurrency,
        fiscalYearStartMonth: source.fiscalYearStartMonth,
        taxRegistrationNumber: source.taxRegistrationNumber,
        addressLine1: source.addressLine1,
        addressLine2: source.addressLine2,
        city: source.city,
        region: source.region,
        postalCode: source.postalCode,
        country: source.country,
        phone: source.phone,
        email: source.email,
        website: source.website,
        timeZone: source.timeZone,
        allowNegativeStock: source.allowNegativeStock,
        featureFlags: source.featureFlags ?? undefined,
        documentTemplate: source.documentTemplate ?? undefined,
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

    if (sequences.length) {
      await tx.documentSequence.createMany({
        data: sequences.map((seq) => ({
          orgId: newOrgId,
          docType: seq.docType,
          prefix: seq.prefix,
          nextNumber: 1,
          padding: seq.padding,
        })),
      })
    }

    const accountRows = accounts.map((account) => {
      const id = map(account.id)
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
    if (accountRows.length) await tx.ledgerAccount.createMany({ data: accountRows })
    for (const account of accounts) {
      if (!account.parentId) continue
      const id = idMap.get(account.id)
      const parentId = idMap.get(account.parentId)
      if (id && parentId) {
        await tx.ledgerAccount.update({ where: { id }, data: { parentId } })
      }
    }

    // Master data samples (terms / categories) so the restored company is usable.
    for (const term of paymentTerms) {
      await tx.paymentTerm.create({
        data: {
          id: map(term.id),
          orgId: newOrgId,
          name: term.name,
          days: term.days,
          isDefault: term.isDefault,
        },
      })
    }
    for (const cat of itemCategories) {
      await tx.itemCategory.create({
        data: {
          id: map(cat.id),
          orgId: newOrgId,
          name: cat.name,
        },
      })
    }

    await tx.auditLog.create({
      data: {
        orgId: newOrgId,
        actorId: owner.id,
        entity: 'Organization',
        entityId: newOrgId,
        action: 'CREATE',
        after: {
          name: testName,
          via: 'backup-import-test',
          restoredFrom: source.name,
          accounts: accounts.length,
          customers: customers.length,
          items: items.length,
        },
      },
    })
  },
  { maxWait: 20_000, timeout: 180_000 },
)

const companies = await db.organization.findMany({
  select: { name: true },
  orderBy: { createdAt: 'asc' },
})
console.log(
  JSON.stringify(
    {
      ok: true,
      restoredAs: testName,
      orgId: newOrgId,
      chartAccounts: accounts.length,
      totalCompanies: companies.length,
      companies: companies.map((c) => c.name),
    },
    null,
    2,
  ),
)
await db.$disconnect()
