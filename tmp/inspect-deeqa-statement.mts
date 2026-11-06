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

const org = await prisma.organization.findFirst({
  where: { name: { contains: 'FURAAT MATERIALS', mode: 'insensitive' } },
  select: { id: true, name: true },
})
console.log('org', org)
if (!org) process.exit(1)

const customer = await prisma.customer.findFirst({
  where: { orgId: org.id, displayName: { equals: 'DEEQA CONSTRACTION', mode: 'insensitive' } },
  select: { id: true, displayName: true },
})
console.log('customer', customer)
if (!customer) process.exit(1)

const docs = await prisma.salesDocument.findMany({
  where: {
    orgId: org.id,
    customerId: customer.id,
    type: 'INVOICE',
    status: { notIn: ['DRAFT', 'VOID', 'DECLINED'] },
  },
  select: {
    id: true,
    number: true,
    date: true,
    total: true,
    status: true,
    memo: true,
    reference: true,
    journalId: true,
    _count: { select: { lines: true, applications: true, creditsApplied: true } },
  },
  orderBy: { date: 'asc' },
})
const sum = docs.reduce((s, d) => s + Number(d.total), 0)
console.log('invoices', docs.length, 'sum', sum.toFixed(2))
const near = docs.filter((d) => Math.abs(Number(d.total) - 111823.35) < 1 || Number(d.total) > 20000)
console.log(
  'big/near',
  near.map((d) => `${d.number} ${String(d.date).slice(0, 10)} ${d.total} lines=${d._count.lines} apps=${d._count.applications}`),
)

const nov = docs.filter((d) => String(d.date).startsWith('2026-11') || String(d.date).includes('Nov'))
console.log(
  'nov-ish',
  docs
    .filter((d) => {
      const iso = new Date(d.date).toISOString().slice(0, 10)
      return iso >= '2026-10-01'
    })
    .map((d) => `${d.number} ${new Date(d.date).toISOString().slice(0, 10)} ${d.total} lines=${d._count.lines}`),
)

const ar = await prisma.$queryRawUnsafe<{ balance: string; charges: string; credits: string }[]>(
  `SELECT
     COALESCE(SUM(l.debit - l.credit),0)::text AS balance,
     COALESCE(SUM(l.debit),0)::text AS charges,
     COALESCE(SUM(l.credit),0)::text AS credits
   FROM journal_lines l
   JOIN ledger_accounts a ON a.id = l."accountId"
   WHERE l."orgId" = $1 AND l."customerId" = $2 AND a.subtype::text = 'ACCOUNTS_RECEIVABLE'`,
  org.id,
  customer.id,
)
console.log('AR ledger', ar)

const payments = await prisma.customerPayment.findMany({
  where: { orgId: org.id, customerId: customer.id, status: { not: 'VOID' } },
  select: {
    number: true,
    date: true,
    amount: true,
    applications: { select: { amount: true, invoice: { select: { number: true } } } },
  },
  orderBy: { date: 'asc' },
})
console.log('payments', payments.length)
console.log(
  payments.slice(0, 20).map((p) => ({
    n: p.number,
    d: new Date(p.date).toISOString().slice(0, 10),
    a: String(p.amount),
    apps: p.applications.map((x) => `${x.invoice.number}:${x.amount}`),
  })),
)

const journals = await prisma.journalLine.findMany({
  where: {
    orgId: org.id,
    customerId: customer.id,
    account: { subtype: 'ACCOUNTS_RECEIVABLE' },
  },
  select: {
    debit: true,
    credit: true,
    journalDate: true,
    description: true,
    journal: { select: { journalNumber: true, memo: true, sourceType: true } },
  },
  orderBy: { journalDate: 'desc' },
  take: 15,
})
console.log(
  'recent AR lines',
  journals.map((j) => ({
    d: new Date(j.journalDate).toISOString().slice(0, 10),
    je: j.journal.journalNumber,
    src: j.journal.sourceType,
    debit: String(j.debit),
    credit: String(j.credit),
    desc: j.description ?? j.journal.memo,
  })),
)

await prisma.$disconnect()
