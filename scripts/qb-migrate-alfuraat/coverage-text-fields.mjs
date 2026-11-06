import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

try {
  process.loadEnvFile('.env')
} catch {
  /* ok */
}

const org = 'cmvezuwzw000507l8ewxbhc15'
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const inv = await p.salesDocument.count({ where: { orgId: org, type: 'INVOICE' } })
const withPo = await p.salesDocument.count({
  where: { orgId: org, type: 'INVOICE', NOT: { reference: null }, reference: { not: '' } },
})
const withIn = await p.salesDocument.count({
  where: { orgId: org, type: 'INVOICE', NOT: { inRef: null }, inRef: { not: '' } },
})
const withMemo = await p.salesDocument.count({
  where: { orgId: org, type: 'INVOICE', NOT: { memo: null }, memo: { not: '' } },
})
const lines = await p.salesDocumentLine.count({ where: { document: { orgId: org, type: 'INVOICE' } } })
const withDesc = await p.salesDocumentLine.count({
  where: { document: { orgId: org, type: 'INVOICE' }, NOT: { description: null }, description: { not: '' } },
})
const billLines = await p.purchaseDocumentLine.count({ where: { document: { orgId: org, type: 'BILL' } } })
const billDesc = await p.purchaseDocumentLine.count({
  where: { document: { orgId: org, type: 'BILL' }, NOT: { description: null }, description: { not: '' } },
})
const sample0970 = await p.salesDocument.findFirst({
  where: { orgId: org, type: 'INVOICE', number: '0970' },
  select: {
    number: true,
    reference: true,
    inRef: true,
    memo: true,
    lines: { select: { lineNumber: true, description: true }, orderBy: { lineNumber: 'asc' }, take: 5 },
  },
})

console.log(
  JSON.stringify({ inv, withPo, withIn, withMemo, lines, withDesc, billLines, billDesc, sample0970 }, null, 2),
)
await p.$disconnect()
