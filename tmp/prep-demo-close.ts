/**
 * Prep Tijaabo Trading so month + year close can be demoed in the browser:
 * ensure FY 2025 (already ended) exists and post a small P&L journal into it.
 */
try {
  process.loadEnvFile('.env')
} catch {
  /* */
}

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { ensureFiscalYear } from '@/server/accounting/period'
import { postJournal } from '@/server/accounting/posting'
import type { OrgContext } from '@/server/auth/context'
import { permissionsFor } from '@/server/auth/permissions'

const ORG_NAME = 'Tijaabo Trading'

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set.')

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  transactionOptions: { maxWait: 15_000, timeout: 60_000 },
})

async function main() {
  const org = await db.organization.findFirst({
    where: { name: { equals: ORG_NAME, mode: 'insensitive' } },
    select: {
      id: true,
      name: true,
      baseCurrency: true,
      fiscalYearStartMonth: true,
      timeZone: true,
      featureFlags: true,
      memberships: {
        where: { role: 'OWNER', status: 'ACTIVE' },
        take: 1,
        select: { userId: true, role: true, user: { select: { email: true } } },
      },
    },
  })
  if (!org) throw new Error(`${ORG_NAME} not found`)
  const membership = org.memberships[0]
  if (!membership) throw new Error('No owner membership')

  const ctx = {
    orgId: org.id,
    userId: membership.userId,
    role: membership.role,
    permissions: permissionsFor(membership.role),
    isSystemOwner: false,
    organization: {
      id: org.id,
      name: org.name,
      baseCurrency: org.baseCurrency,
      fiscalYearStartMonth: org.fiscalYearStartMonth,
      timeZone: org.timeZone,
    },
  } as OrgContext

  const result = await db.$transaction(async (tx) => {
    const fy2025 = await ensureFiscalYear(tx as never, org.id, org.fiscalYearStartMonth, 2025)
    const fy2026 = await ensureFiscalYear(tx as never, org.id, org.fiscalYearStartMonth, 2026)

    const revenue = await tx.ledgerAccount.findFirst({
      where: { orgId: org.id, code: '4000' },
      select: { id: true, name: true },
    })
    const cash = await tx.ledgerAccount.findFirst({
      where: { orgId: org.id, systemKey: 'UNDEPOSITED_FUNDS' },
      select: { id: true, name: true },
    })
    const bank =
      cash ??
      (await tx.ledgerAccount.findFirst({
        where: { orgId: org.id, type: 'ASSET', isActive: true },
        orderBy: { code: 'asc' },
        select: { id: true, name: true },
      }))
    const expense = await tx.ledgerAccount.findFirst({
      where: { orgId: org.id, code: '6100' },
      select: { id: true, name: true },
    })

    if (!revenue || !bank || !expense) {
      throw new Error('Needed accounts missing — seed chart first.')
    }

    const already = await tx.journal.findFirst({
      where: {
        orgId: org.id,
        memo: { contains: 'Tijaabo demo close' },
        deletedAt: null,
      },
      select: { id: true, journalNumber: true },
    })

    let journalNumber: string | null = already?.journalNumber ?? null
    if (!already) {
      const posted = await postJournal(tx as never, ctx, {
        date: '2025-06-15',
        memo: 'Tijaabo demo close — sample income & expense',
        sourceType: 'MANUAL',
        lines: [
          { accountId: bank.id, debit: '1000.00', credit: '0', description: 'Cash from sales' },
          { accountId: revenue.id, debit: '0', credit: '1000.00', description: 'Sales' },
          { accountId: expense.id, debit: '250.00', credit: '0', description: 'Office expense' },
          { accountId: bank.id, debit: '0', credit: '250.00', description: 'Paid expense' },
        ],
      })
      journalNumber = posted.journalNumber
    }

    const openPeriods = await tx.accountingPeriod.findMany({
      where: { orgId: org.id, fiscalYear: { year: 2025 }, status: 'OPEN' },
      orderBy: { periodNumber: 'asc' },
      select: { id: true, periodNumber: true, startDate: true, endDate: true, status: true },
    })

    return {
      org: org.name,
      email: membership.user.email,
      fy2025: fy2025.year,
      fy2026: fy2026.year,
      journalNumber,
      open2025Periods: openPeriods.map((p) => p.periodNumber),
    }
  })

  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
