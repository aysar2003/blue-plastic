/**
 * Create a simple demo company for learning period close.
 * Run: node tmp/run-create-demo-company.mjs
 */
try {
  process.loadEnvFile('.env')
} catch {
  // already loaded
}

import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { DocumentType, PrismaClient } from '@prisma/client'

import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags'
import { fiscalYearOf, today } from '@/lib/date'
import { seedChartOfAccounts } from '@/server/accounting/chart-of-accounts'
import { ensureFiscalYear } from '@/server/accounting/period'

const ORG_NAME = 'Tijaabo Trading'
const OWNER_EMAIL = 'tijaabo@demo.test'
const OWNER_NAME = 'Tijaabo Owner'
const OWNER_PASSWORD = 'Tijaabo123!'
const BASE_CURRENCY = 'USD'
const FISCAL_YEAR_START_MONTH = 1

const DEFAULT_PREFIX: Record<DocumentType, string> = {
  JOURNAL: 'JE-',
  INVOICE: 'INV-',
  ESTIMATE: 'EST-',
  QUOTATION: 'QUO-',
  SALES_ORDER: 'SO-',
  SALES_RECEIPT: 'SR-',
  CREDIT_MEMO: 'CM-',
  CUSTOMER_PAYMENT: 'PMT-',
  REFUND_RECEIPT: 'RFD-',
  BILL: 'BILL-',
  BILL_PAYMENT: 'BP-',
  EXPENSE: 'EXP-',
  VENDOR_CREDIT: 'VC-',
  PURCHASE_ORDER: 'PO-',
  PURCHASE_REQUEST: 'PR-',
  RFQ: 'RFQ-',
  TRANSFER: 'TRF-',
  DEPOSIT: 'DEP-',
  INVENTORY_ADJUSTMENT: 'ADJ-',
  STORE_TRANSFER: 'STX-',
  STORE_TICKET: 'TKT-',
  DELIVERY_NOTE: 'DN-',
  ASSEMBLY_BUILD: 'BLD-',
  WORK_ORDER: 'WO-',
  PROJECT: 'PRJ-',
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set.')

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  transactionOptions: { maxWait: 15_000, timeout: 60_000 },
})

async function main() {
  const existing = await db.organization.findFirst({
    where: { name: { equals: ORG_NAME, mode: 'insensitive' } },
    select: {
      id: true,
      name: true,
      memberships: {
        where: { role: 'OWNER', status: 'ACTIVE' },
        take: 1,
        select: { user: { select: { email: true } } },
      },
      fiscalYears: {
        orderBy: { year: 'desc' },
        take: 1,
        select: { year: true, _count: { select: { periods: true } } },
      },
    },
  })

  if (existing) {
    console.log(
      JSON.stringify(
        {
          status: 'already_exists',
          organization: existing.name,
          email: existing.memberships[0]?.user.email ?? OWNER_EMAIL,
          password: OWNER_PASSWORD,
          fiscalYear: existing.fiscalYears[0] ?? null,
          login: 'http://localhost:3000/login',
        },
        null,
        2,
      ),
    )
    return
  }

  const emailTaken = await db.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true },
  })
  if (emailTaken) {
    throw new Error(`Email ${OWNER_EMAIL} is already in use. Pick another demo email.`)
  }

  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12)
  const trialEnds = new Date()
  trialEnds.setUTCDate(trialEnds.getUTCDate() + 14)

  const result = await db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: ORG_NAME,
        baseCurrency: BASE_CURRENCY,
        fiscalYearStartMonth: FISCAL_YEAR_START_MONTH,
        timeZone: 'Africa/Mogadishu',
        rentExpiresAt: trialEnds,
        rentNote: 'Free trial — demo company for learning close',
        featureFlags: DEFAULT_FEATURE_FLAGS as never,
      },
      select: { id: true, name: true, fiscalYearStartMonth: true, timeZone: true },
    })

    const user = await tx.user.create({
      data: {
        email: OWNER_EMAIL,
        name: OWNER_NAME,
        passwordHash,
        emailVerified: new Date(),
        isSystemOwner: false,
        homeOrgId: organization.id,
      },
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

    const chart = await seedChartOfAccounts(tx as never, organization.id)

    const year = fiscalYearOf(today(organization.timeZone), organization.fiscalYearStartMonth)
    const fiscal = await ensureFiscalYear(
      tx as never,
      organization.id,
      organization.fiscalYearStartMonth,
      year,
    )

    const periodCount = await tx.accountingPeriod.count({
      where: { fiscalYearId: fiscal.id },
    })

    await tx.auditLog.create({
      data: {
        orgId: organization.id,
        actorId: user.id,
        entity: 'Organization',
        entityId: organization.id,
        action: 'CREATE',
        after: {
          name: organization.name,
          owner: user.email,
          via: 'tmp/create-demo-company',
          chartCreated: chart.created,
          fiscalYear: fiscal.year,
          periods: periodCount,
        },
      },
    })

    return {
      organization: organization.name,
      organizationId: organization.id,
      email: user.email,
      password: OWNER_PASSWORD,
      chartCreated: chart.created,
      fiscalYear: fiscal.year,
      periods: periodCount,
      login: 'http://localhost:3000/login',
    }
  })

  console.log(JSON.stringify({ status: 'created', ...result }, null, 2))
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
