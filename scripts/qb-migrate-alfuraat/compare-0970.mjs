import fs from 'node:fs'
import path from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

try {
  process.loadEnvFile('.env')
} catch {
  /* ok */
}

const dir = 'C:\\Users\\Zmart\\Desktop\\qb-alfuraat-export'
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1].trim() : ''
}
function blocks(xml, name) {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g')
  const out = []
  let m
  while ((m = re.exec(xml))) out.push(m[1])
  return out
}
function decode(s) {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

const xml = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith('invoices') && f.endsWith('.xml'))
  .sort()
  .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n')

let qbLines = []
for (const block of blocks(xml, 'InvoiceRet')) {
  if ((tag(block, 'RefNumber') || tag(block, 'TxnNumber')) !== '0970') continue
  qbLines = blocks(block, 'InvoiceLineRet').map((line, i) => ({
    i: i + 1,
    item: tag(line.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName'),
    desc: decode(tag(line, 'Desc')),
    qty: tag(line, 'Quantity'),
    amount: tag(line, 'Amount'),
  }))
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})
const doc = await prisma.salesDocument.findFirst({
  where: { orgId: 'cmvezuwzw000507l8ewxbhc15', type: 'INVOICE', number: '0970' },
  select: {
    lines: {
      orderBy: { lineNumber: 'asc' },
      select: {
        lineNumber: true,
        description: true,
        quantity: true,
        amount: true,
        item: { select: { name: true } },
      },
    },
  },
})
console.log(
  JSON.stringify(
    {
      qbCount: qbLines.length,
      dbCount: doc?.lines.length,
      rows: qbLines.map((q, i) => ({
        qb: q,
        db: doc?.lines[i]
          ? {
              lineNumber: doc.lines[i].lineNumber,
              item: doc.lines[i].item?.name,
              desc: doc.lines[i].description,
              qty: doc.lines[i].quantity.toString(),
              amount: doc.lines[i].amount.toString(),
            }
          : null,
      })),
    },
    null,
    2,
  ),
)
await prisma.$disconnect()
