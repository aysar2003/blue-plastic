/**
 * Replace the TB lump-sum customer AR with QuickBooks open-item receivables.
 *
 * migrate-tb posted one AR balance per customer and imported invoices as paper
 * only (no journals). Statements then either showed a bare balance or treated
 * every historical invoice as a new charge. This rebuild:
 *
 * 1. Reverses customer AR lines on the conversion journal into equity
 * 2. Posts each QB invoice BalanceRemaining as Dr AR / Cr equity (no P&L hit)
 * 3. Posts unapplied QB payments as Dr undeposited / Cr AR
 * 4. Plugs each customer to the QB customer Balance
 *
 * Run: pnpm exec tsx scripts/qb-migrate-alfuraat/rebuild-open-ar.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

try {
  process.loadEnvFile('.env')
} catch {
  /* ok */
}

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags'
import { Decimal, ZERO } from '@/lib/money'
import { postJournal, reverseJournal } from '@/server/accounting/posting'
import { systemAccountId } from '@/server/accounting/chart-of-accounts'
import { permissionsFor } from '@/server/auth/permissions'
import type { OrgContext } from '@/server/auth/context'

const ORG_ID = 'cmvezuwzw000507l8ewxbhc15'
const ORG_NAME = 'AL FURAAT MATERIALS'
const EXPORT_DIRS = [
  path.join(process.env.USERPROFILE ?? 'C:\\Users\\Zmart', 'Desktop', 'qb-alfuraat-export'),
  'C:\\Users\\Zmart\\qb-export',
]
const CONV_DATE = '2026-11-02'
const IDEM = 'qb-open-ar-rebuild-v1'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! }),
  transactionOptions: { maxWait: 30_000, timeout: 180_000 },
})

function tag(xml: string, name: string) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1]!.trim() : ''
}
function blocks(xml: string, name: string) {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(m[1]!)
  return out
}
function money(raw: string) {
  const n = Number(String(raw).replace(/,/g, ''))
  if (!Number.isFinite(n)) return '0'
  return n.toFixed(4).replace(/\.?0+$/, '') || '0'
}
function nid() {
  return `c${randomBytes(12).toString('hex')}`
}
function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  )
}
function findDir() {
  for (const d of EXPORT_DIRS) if (fs.existsSync(path.join(d, 'customers.xml'))) return d
  throw new Error('QB export dir missing')
}
function readAll(dir: string, prefix: string) {
  return fs
    .readdirSync(dir)
    .filter((f) => f === `${prefix}.xml` || (f.startsWith(`${prefix}-part`) && f.endsWith('.xml')))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')
}
function custName(block: string) {
  const ref = block.match(/<CustomerRef>[\s\S]*?<\/CustomerRef>/)?.[0] ?? ''
  return tag(ref, 'FullName')
}

async function buildCtx(orgId: string): Promise<OrgContext> {
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })
  const membership = await prisma.membership.findFirstOrThrow({
    where: { orgId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } },
    include: { user: true },
  })
  const { logoStorageKey, ...orgFields } = organization
  return {
    orgId,
    userId: membership.userId,
    role: membership.role,
    permissions: permissionsFor(membership.role),
    isSystemOwner: membership.user.isSystemOwner,
    canConnect: membership.canConnect,
    portalCustomerId: null,
    features: { ...DEFAULT_FEATURE_FLAGS, enableDocumentApprovals: false },
    organization: { ...orgFields, hasLogo: Boolean(logoStorageKey) },
    user: {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      image: membership.user.image,
    },
  }
}

export async function main() {
  const dir = findDir()
  console.log('Export:', dir)

  const org = await prisma.organization.findFirst({
    where: { OR: [{ id: ORG_ID }, { name: { equals: ORG_NAME, mode: 'insensitive' } }] },
  })
  if (!org) throw new Error('org missing')
  const ctx = await buildCtx(org.id)

  const reverseExists = await prisma.journal.findFirst({
    where: { orgId: org.id, idempotencyKey: `${IDEM}-reverse-tb-ar` },
    select: { id: true, journalNumber: true },
  })
  if (reverseExists) {
    console.log('TB AR reverse already posted:', reverseExists.journalNumber)
  }

  const arId = await systemAccountId(prisma as never, org.id, 'ACCOUNTS_RECEIVABLE')
  const equityId = await systemAccountId(prisma as never, org.id, 'OPENING_BALANCE_EQUITY')
  const undepositedId = await systemAccountId(prisma as never, org.id, 'UNDEPOSITED_FUNDS')

  const customers = await prisma.customer.findMany({
    where: { orgId: org.id },
    select: { id: true, displayName: true },
  })
  const customerByName = new Map(customers.map((c) => [c.displayName.toLowerCase(), c.id]))

  const qbBalance = new Map<string, Decimal>()
  for (const block of blocks(readAll(dir, 'customers'), 'CustomerRet')) {
    const name = tag(block, 'Name') || tag(block, 'FullName')
    if (!name) continue
    qbBalance.set(name.toLowerCase(), new Decimal(money(tag(block, 'Balance') || '0')))
  }

  const openInvoices: {
    customer: string
    number: string
    date: string
    remaining: Decimal
    txnId: string
  }[] = []
  for (const block of blocks(readAll(dir, 'invoices'), 'InvoiceRet')) {
    const customer = custName(block)
    const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
    const date = tag(block, 'TxnDate')
    const remaining = new Decimal(money(tag(block, 'BalanceRemaining') || '0'))
    if (!customer || !number || !date || remaining.lessThanOrEqualTo('0.004')) continue
    openInvoices.push({
      customer,
      number,
      date,
      remaining,
      txnId: tag(block, 'TxnID') || nid(),
    })
  }

  const unapplied: { customer: string; date: string; ref: string; amount: Decimal; txnId: string }[] = []
  for (const block of blocks(readAll(dir, 'payments'), 'ReceivePaymentRet')) {
    const customer = custName(block)
    const date = tag(block, 'TxnDate')
    const total = new Decimal(money(tag(block, 'TotalAmount') || '0'))
    if (!customer || !date || total.lessThanOrEqualTo(0)) continue
    let applied = ZERO
    for (const line of blocks(block, 'AppliedToTxnRet')) {
      applied = applied.plus(money(tag(line, 'Amount') || '0'))
    }
    const leftover = total.minus(applied)
    if (leftover.lessThanOrEqualTo('0.004')) continue
    unapplied.push({
      customer,
      date,
      ref: tag(block, 'RefNumber') || tag(block, 'TxnID') || nid(),
      amount: leftover,
      txnId: tag(block, 'TxnID') || nid(),
    })
  }

  console.log('open invoices', openInvoices.length, 'unapplied payments', unapplied.length)

  // 1) Reverse TB customer AR into equity
  const tb = await prisma.journal.findFirst({
    where: { orgId: org.id, idempotencyKey: 'qb-tb-conversion' },
    select: {
      id: true,
      journalNumber: true,
      lines: {
        where: { accountId: arId, customerId: { not: null } },
        select: { debit: true, credit: true, customerId: true, description: true },
      },
    },
  })
  if (!tb) throw new Error('qb-tb-conversion journal missing')

  const reverseLines = tb.lines
    .map((line) => {
      const debit = new Decimal(line.debit.toString())
      const credit = new Decimal(line.credit.toString())
      const net = debit.minus(credit)
      if (net.abs().lessThanOrEqualTo('0.004') || !line.customerId) return null
      // Undo Dr AR: Cr AR, Dr Equity
      return [
        {
          accountId: equityId,
          debit: net.isPositive() ? net.toFixed(4) : '0',
          credit: net.isNegative() ? net.abs().toFixed(4) : '0',
          description: `Reverse TB AR · ${line.description ?? ''}`.trim(),
        },
        {
          accountId: arId,
          debit: net.isNegative() ? net.abs().toFixed(4) : '0',
          credit: net.isPositive() ? net.toFixed(4) : '0',
          customerId: line.customerId,
          description: `Reverse TB AR · ${line.description ?? ''}`.trim(),
        },
      ]
    })
    .flat()
    .filter(Boolean) as {
    accountId: string
    debit: string
    credit: string
    customerId?: string
    description: string
  }[]

  if (!reverseExists) {
    await prisma.$transaction(async (tx) => {
      await postJournal(tx as never, ctx, {
        date: CONV_DATE,
        memo: 'QB rebuild: clear trial-balance customer AR for open-item conversion',
        sourceType: 'OPENING_BALANCE',
        idempotencyKey: `${IDEM}-reverse-tb-ar`,
        lines: reverseLines,
      })
    })
    console.log('reversed TB AR lines', reverseLines.length / 2)
  }

  // 2) Post open invoice remainders
  const docs = await prisma.salesDocument.findMany({
    where: { orgId: org.id, type: 'INVOICE' },
    select: { id: true, number: true, customerId: true, total: true, journalId: true },
  })
  const docByCustomerNumber = new Map(docs.map((d) => [`${d.customerId}::${d.number}`, d]))
  const incomeId = await systemAccountId(prisma as never, org.id, 'UNCATEGORISED_INCOME')

  let postedOpen = 0
  let missingDocs = 0
  let createdDocs = 0
  for (const row of openInvoices) {
    const customerId = customerByName.get(row.customer.toLowerCase())
    if (!customerId) {
      missingDocs++
      continue
    }
    let doc = docByCustomerNumber.get(`${customerId}::${row.number}`)
    if (!doc) {
      // Trial-balance import skipped some paper invoices (empty lines / number clashes).
      // Create a stub so the open-item journal can appear on the statement like QB.
      const amt = row.remaining.toFixed(4)
      const clash = await prisma.salesDocument.findUnique({
        where: { orgId_type_number: { orgId: org.id, type: 'INVOICE', number: row.number } },
        select: { id: true, customerId: true },
      })
      // Numbers are org-wide unique — if another customer already owns RefNumber, keep QB id.
      const number =
        clash && clash.customerId !== customerId
          ? `QB-${row.txnId}`.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40)
          : row.number
      const existingStub = docByCustomerNumber.get(`${customerId}::${number}`)
      if (existingStub) {
        doc = existingStub
      } else {
        const created = await prisma.salesDocument.create({
          data: {
            id: nid(),
            orgId: org.id,
            type: 'INVOICE',
            number,
            customerId,
            date: new Date(`${row.date}T00:00:00.000Z`),
            status: 'OPEN',
            subtotal: amt,
            total: amt,
            currencyCode: 'USD',
            reference: row.number !== number ? row.number : null,
            memo: 'Open balance from QuickBooks (paper missing at conversion)',
            createdById: ctx.userId,
            lines: {
              create: [
                {
                  orgId: org.id,
                  lineNumber: 1,
                  description: `Open balance · Invoice ${row.number}`,
                  quantity: '1',
                  unitPrice: amt,
                  amount: amt,
                  incomeAccountId: incomeId,
                },
              ],
            },
          },
          select: { id: true, number: true, customerId: true, total: true, journalId: true },
        })
        doc = created
        docByCustomerNumber.set(`${customerId}::${created.number}`, created)
        docByCustomerNumber.set(`${customerId}::${row.number}`, created)
        createdDocs++
      }
    }
    const amt = row.remaining.toFixed(4)
    const key = `${IDEM}-inv-${doc.id}`
    const prior = await prisma.journal.findUnique({
      where: { orgId_idempotencyKey: { orgId: org.id, idempotencyKey: key } },
      select: { id: true },
    })
    if (prior) {
      if (!doc.journalId) {
        await prisma.salesDocument.update({
          where: { id: doc.id },
          data: { status: 'OPEN', journalId: prior.id },
        })
      }
      postedOpen++
      continue
    }
    try {
      await prisma.$transaction(async (tx) => {
        const journal = await postJournal(tx as never, ctx, {
          date: row.date,
          memo: `QB open invoice ${row.number}`,
          sourceType: 'OPENING_BALANCE',
          sourceId: doc.id,
          idempotencyKey: key,
          lines: [
            {
              accountId: arId,
              debit: amt,
              credit: '0',
              customerId,
              description: `Open balance · Invoice ${row.number}`,
            },
            {
              accountId: equityId,
              debit: '0',
              credit: amt,
              description: `Open balance · Invoice ${row.number}`,
            },
          ],
        })
        await tx.salesDocument.update({
          where: { id: doc.id },
          data: {
            status: 'OPEN',
            // Keep paper total; AR open amount comes from the conversion journal.
            journalId: doc.journalId ?? journal.id,
          },
        })
      })
      postedOpen++
      if (postedOpen % 50 === 0) console.log('  open invoices', postedOpen)
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await prisma.journal.findUnique({
          where: { orgId_idempotencyKey: { orgId: org.id, idempotencyKey: key } },
          select: { id: true },
        })
        if (existing && !doc.journalId) {
          await prisma.salesDocument.update({
            where: { id: doc.id },
            data: { status: 'OPEN', journalId: existing.id },
          })
        }
        postedOpen++
        continue
      }
      console.error('open invoice failed', row.number, error instanceof Error ? error.message : error)
    }
  }
  console.log('posted open invoices', postedOpen, 'created stubs', createdDocs, 'missing customers', missingDocs)

  // Mark fully paid QB invoices as PAID when they have no remaining balance
  const paidNumbers = new Set<string>()
  for (const block of blocks(readAll(dir, 'invoices'), 'InvoiceRet')) {
    const customer = custName(block)
    const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
    const remaining = new Decimal(money(tag(block, 'BalanceRemaining') || '0'))
    const customerId = customer ? customerByName.get(customer.toLowerCase()) : undefined
    if (!customerId || !number || remaining.greaterThan('0.004')) continue
    paidNumbers.add(`${customerId}::${number}`)
  }
  let markedPaid = 0
  for (const doc of docs) {
    if (!paidNumbers.has(`${doc.customerId}::${doc.number}`)) continue
    if (doc.journalId) continue
    await prisma.salesDocument.update({
      where: { id: doc.id },
      data: { status: 'PAID' },
    })
    markedPaid++
  }
  console.log('marked paid history invoices', markedPaid)

  // 3) Unapplied payments → credit AR
  let postedPay = 0
  for (const row of unapplied) {
    const customerId = customerByName.get(row.customer.toLowerCase())
    if (!customerId) continue
    const amt = row.amount.toFixed(4)
    const idem = `${IDEM}-uap-${row.txnId}`
    const prior = await prisma.journal.findUnique({
      where: { orgId_idempotencyKey: { orgId: org.id, idempotencyKey: idem } },
      select: { id: true },
    })
    if (prior) {
      postedPay++
      continue
    }
    const payId = nid()
    const number = `UAP-${row.ref}`.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40)
    try {
      await prisma.$transaction(async (tx) => {
        const journal = await postJournal(tx as never, ctx, {
          date: row.date,
          memo: `QB unapplied payment ${row.ref}`,
          sourceType: 'CUSTOMER_PAYMENT',
          sourceId: payId,
          idempotencyKey: idem,
          lines: [
            { accountId: undepositedId, debit: amt, credit: '0', description: 'Unapplied customer payment' },
            {
              accountId: arId,
              debit: '0',
              credit: amt,
              customerId,
              description: 'Unapplied customer payment',
            },
          ],
        })
        await tx.customerPayment.create({
          data: {
            id: payId,
            orgId: org.id,
            number,
            customerId,
            date: new Date(`${row.date}T00:00:00.000Z`),
            amount: amt,
            method: 'OTHER',
            depositAccountId: undepositedId,
            currencyCode: 'USD',
            journalId: journal.id,
            status: 'OPEN',
            reference: row.ref || null,
            memo: 'Imported unapplied QuickBooks payment (open-item conversion)',
            createdById: ctx.userId,
          },
        })
      })
      postedPay++
    } catch (error) {
      if (isUniqueViolation(error)) {
        postedPay++
        continue
      }
      console.error('unapplied payment failed', row.ref, error instanceof Error ? error.message : error)
    }
  }
  console.log('posted unapplied payments', postedPay)

  // 4) Plug each customer to QB Balance.
  // Reverse the prior plug when stubs were added (or the original v1 plug is still live)
  // so open-item journals are not double-counted against a stale plug.
  const plugKey = `${IDEM}-ar-plugs-v3`
  const priorPlugKeys = [`${IDEM}-ar-plugs`, `${IDEM}-ar-plugs-v2`, plugKey]
  const priorPlugs = []
  for (const key of priorPlugKeys) {
    const row = await prisma.journal.findUnique({
      where: { orgId_idempotencyKey: { orgId: org.id, idempotencyKey: key } },
      select: { id: true, status: true, journalNumber: true, idempotencyKey: true },
    })
    if (row) priorPlugs.push(row)
  }
  const livePlug = priorPlugs.find((row) => row.status === 'POSTED')
  const shouldReplug =
    createdDocs > 0 || (livePlug != null && livePlug.idempotencyKey !== plugKey)
  if (shouldReplug) {
    for (const priorPlug of priorPlugs) {
      if (priorPlug.status !== 'POSTED') continue
      await prisma.$transaction(async (tx) => {
        await reverseJournal(tx as never, ctx, priorPlug.id, {
          date: CONV_DATE,
          reason: 'Recompute QB open-item AR plugs after stub invoices',
        })
      })
      console.log('reversed prior AR plugs', priorPlug.journalNumber)
    }
  }

  const arRows = await prisma.$queryRaw<{ customerId: string; balance: string }[]>`
    SELECT l."customerId" AS "customerId",
           COALESCE(SUM(l.debit - l.credit), 0)::text AS balance
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
     WHERE l."orgId" = ${org.id}
       AND l."accountId" = ${arId}
       AND l."customerId" IS NOT NULL
     GROUP BY l."customerId"
  `
  const arByCustomer = new Map(arRows.map((r) => [r.customerId, new Decimal(r.balance)]))

  let plugs = 0
  const plugLines: {
    accountId: string
    debit: string
    credit: string
    customerId?: string
    description: string
  }[] = []
  for (const customer of customers) {
    const target = qbBalance.get(customer.displayName.toLowerCase()) ?? ZERO
    const have = arByCustomer.get(customer.id) ?? ZERO
    const diff = target.minus(have)
    if (diff.abs().lessThanOrEqualTo('0.004')) continue
    // Need more AR: Dr AR Cr Equity. Need less AR: Dr Equity Cr AR.
    if (diff.isPositive()) {
      plugLines.push(
        {
          accountId: arId,
          debit: diff.toFixed(4),
          credit: '0',
          customerId: customer.id,
          description: `QB AR plug · ${customer.displayName}`,
        },
        {
          accountId: equityId,
          debit: '0',
          credit: diff.toFixed(4),
          description: `QB AR plug · ${customer.displayName}`,
        },
      )
    } else {
      const amt = diff.abs()
      plugLines.push(
        {
          accountId: equityId,
          debit: amt.toFixed(4),
          credit: '0',
          description: `QB AR plug · ${customer.displayName}`,
        },
        {
          accountId: arId,
          debit: '0',
          credit: amt.toFixed(4),
          customerId: customer.id,
          description: `QB AR plug · ${customer.displayName}`,
        },
      )
    }
    plugs++
  }

  const plugExists = await prisma.journal.findUnique({
    where: { orgId_idempotencyKey: { orgId: org.id, idempotencyKey: plugKey } },
    select: { id: true, status: true },
  })
  if (plugLines.length && plugExists?.status !== 'POSTED') {
    try {
      await prisma.$transaction(async (tx) => {
        await postJournal(tx as never, ctx, {
          date: CONV_DATE,
          memo: 'QB rebuild: plug customer AR to QuickBooks balances',
          sourceType: 'OPENING_BALANCE',
          idempotencyKey: plugKey,
          lines: plugLines,
        })
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      console.log('AR plugs already posted (concurrent)')
    }
  } else if (plugExists?.status === 'POSTED') {
    console.log('AR plugs already posted')
  }
  console.log('customer plugs', plugs)

  const deeqa = customers.find((c) => c.displayName.toUpperCase() === 'DEEQA CONSTRACTION')
  if (deeqa) {
    const [row] = await prisma.$queryRaw<{ balance: string }[]>`
      SELECT COALESCE(SUM(l.debit - l.credit), 0)::text AS balance
        FROM journal_lines l
        JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
       WHERE l."orgId" = ${org.id}
         AND l."accountId" = ${arId}
         AND l."customerId" = ${deeqa.id}
    `
    console.log('DEEQA CONSTRACTION AR now', row?.balance, 'QB target', qbBalance.get('deeqa constraction')?.toString())
  }

  await prisma.$disconnect()
}

const isDirect =
  process.argv[1]?.includes('rebuild-open-ar') || process.argv[1]?.includes('run-rebuild-open-ar')

if (isDirect) {
  main().catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
}
