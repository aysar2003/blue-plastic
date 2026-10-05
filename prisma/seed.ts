/**
 * Development seed: creates the organisation, its owner, and the document
 * sequences — the same thing the first-run `/setup` screen does, without the
 * browser.
 *
 * Idempotent: if an organisation already exists it reports and exits. It never
 * overwrites, because in this system "reseeding" a populated ledger is not a
 * thing anyone should be able to do by accident.
 *
 * Built as a standalone script rather than importing `server/db.ts`, which is
 * marked `server-only` and would refuse to load outside the Next.js runtime.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { DocumentType, PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

try {
  process.loadEnvFile('.env')
} catch {
  // Environment already populated.
}

const DEFAULT_PREFIX: Record<DocumentType, string> = {
  JOURNAL: 'JE-',
  INVOICE: 'INV-',
  ESTIMATE: 'EST-',
  SALES_RECEIPT: 'SR-',
  CREDIT_MEMO: 'CM-',
  CUSTOMER_PAYMENT: 'PMT-',
  REFUND_RECEIPT: 'RFD-',
  BILL: 'BILL-',
  BILL_PAYMENT: 'BP-',
  EXPENSE: 'EXP-',
  VENDOR_CREDIT: 'VC-',
  PURCHASE_ORDER: 'PO-',
  TRANSFER: 'TRF-',
  DEPOSIT: 'DEP-',
  INVENTORY_ADJUSTMENT: 'ADJ-',
  STORE_TRANSFER: 'STX-',
  STORE_TICKET: 'TKT-',
  DELIVERY_NOTE: 'DN-',
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set.')

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  // Matches server/db.ts: the database is remote and the seed is one transaction.
  transactionOptions: { maxWait: 10_000, timeout: 30_000 },
})

async function main() {
  const existing = await db.organization.findFirst({ select: { id: true, name: true } })
  if (existing) {
    console.log(`Organisation "${existing.name}" already exists — nothing to seed.`)
    return
  }

  const orgName = process.env.SEED_ORG_NAME ?? 'Blue Plastic Center'
  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? 'owner@blueplasticcenter.test').toLowerCase()
  const ownerName = process.env.SEED_OWNER_NAME ?? 'Owner'
  const password = process.env.SEED_OWNER_PASSWORD

  if (!password || password.length < 12) {
    throw new Error(
      'Set SEED_OWNER_PASSWORD in .env to at least 12 characters before seeding.\n' +
        'There is no default password: an accounting system should never ship with one.',
    )
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: orgName,
        baseCurrency: process.env.SEED_BASE_CURRENCY ?? 'USD',
        fiscalYearStartMonth: Number(process.env.SEED_FISCAL_YEAR_START_MONTH ?? 1),
      },
      select: { id: true, name: true },
    })

    const user = await tx.user.create({
      data: { email: ownerEmail, name: ownerName, passwordHash, emailVerified: new Date() },
      select: { id: true, email: true },
    })

    await tx.membership.create({
      data: {
        orgId: organization.id,
        userId: user.id,
        role: 'OWNER',
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    })

    await tx.documentSequence.createMany({
      data: (Object.keys(DEFAULT_PREFIX) as DocumentType[]).map((docType) => ({
        orgId: organization.id,
        docType,
        prefix: DEFAULT_PREFIX[docType],
        nextNumber: 1,
        padding: 5,
      })),
      skipDuplicates: true,
    })

    await tx.auditLog.create({
      data: {
        orgId: organization.id,
        actorId: user.id,
        entity: 'Organization',
        entityId: organization.id,
        action: 'CREATE',
        after: { name: organization.name, owner: user.email, via: 'seed' },
      },
    })

    console.log(`Seeded organisation "${organization.name}" with owner ${user.email}.`)
  })
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
