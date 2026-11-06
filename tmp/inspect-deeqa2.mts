try {
  process.loadEnvFile('.env')
} catch {
  /* ok */
}

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! }),
})

const orgId = 'cmvezuwzw000507l8ewxbhc15'
const customerId = 'c9f9d5e4b0eebe2622a8f71cd'

const withJournal = await prisma.salesDocument.count({
  where: { orgId, customerId, type: 'INVOICE', journalId: { not: null } },
})
const noJournal = await prisma.salesDocument.count({
  where: { orgId, customerId, type: 'INVOICE', journalId: null },
})
console.log({ withJournal, noJournal })

const sample = await prisma.salesDocument.findMany({
  where: { orgId, customerId, type: 'INVOICE' },
  select: {
    number: true,
    total: true,
    journalId: true,
    date: true,
    status: true,
    journal: {
      select: {
        journalNumber: true,
        status: true,
        lines: {
          where: { account: { subtype: 'ACCOUNTS_RECEIVABLE' } },
          select: { debit: true, credit: true },
        },
      },
    },
  },
  orderBy: { date: 'desc' },
  take: 5,
})
console.log(JSON.stringify(sample, null, 2))

const openings = await prisma.journal.findMany({
  where: { orgId, sourceType: 'OPENING_BALANCE' },
  select: {
    journalNumber: true,
    memo: true,
    date: true,
    lines: {
      where: { account: { subtype: 'ACCOUNTS_RECEIVABLE' } },
      select: {
        debit: true,
        credit: true,
        customer: { select: { displayName: true } },
      },
    },
  },
})
for (const o of openings) {
  for (const line of o.lines) {
    console.log({
      je: o.journalNumber,
      memo: o.memo,
      date: o.date,
      customer: line.customer?.displayName,
      debit: String(line.debit),
      credit: String(line.credit),
    })
  }
}

const paymentCount = await prisma.customerPayment.count({ where: { orgId } })
const appCount = await prisma.salesApplication.count({ where: { orgId } })
console.log({ paymentCount, appCount })

await prisma.$disconnect()
