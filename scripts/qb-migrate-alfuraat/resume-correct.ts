/**
 * Resume migrate-correct after DB timeout: remaining bills, journals, payments, bill payments, inventory plug.
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

try {
  process.loadEnvFile('.env')
} catch {
  /* */
}

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags'
import { permissionsFor } from '@/server/auth/permissions'
import type { OrgContext } from '@/server/auth/context'
import { postJournal } from '@/server/accounting/posting'
import { db } from '@/server/db'

const ORG_NAME = 'AL FURAAT MATERIALS'
const EXPORT_DIRS = [
  path.join(process.env.USERPROFILE ?? 'C:\\Users\\Zmart', 'Desktop', 'qb-alfuraat-export'),
  'C:\\Users\\Zmart\\qb-export',
]

const local = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! }),
  transactionOptions: { maxWait: 30_000, timeout: 180_000 },
})

const stats: Record<string, number> = {}
const errors: string[] = []
const bump = (k: string, n = 1) => {
  stats[k] = (stats[k] ?? 0) + n
}
const nid = () => `c${randomBytes(12).toString('hex')}`
const decode = (s: string) =>
  s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? decode(m[1]!.trim()) : ''
}
const blocks = (xml: string, name: string) => {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(m[1]!)
  return out
}
const refName = (block: string, wrap: string) =>
  tag(block.match(new RegExp(`<${wrap}>[\\s\\S]*?</${wrap}>`))?.[0] ?? '', 'FullName')
const money = (raw: string) => {
  const n = Number(String(raw).replace(/,/g, ''))
  return Number.isFinite(n) ? String(Number(n.toFixed(4))) : '0'
}
const findDir = () => {
  for (const d of EXPORT_DIRS) if (fs.existsSync(path.join(d, 'items.xml'))) return d
  throw new Error('no export')
}
const readAll = (dir: string, prefix: string) =>
  fs
    .readdirSync(dir)
    .filter((f) => f === `${prefix}.xml` || (f.startsWith(`${prefix}-part`) && f.endsWith('.xml')))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let last: unknown
  for (let i = 0; i < 6; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      const msg = e instanceof Error ? e.message : String(e)
      if (!/Can't reach database|Connection terminated|timeout exceeded|Timed out/i.test(msg) || i === 5) throw e
      console.log('  retry', label, i + 1, msg.slice(0, 80))
      await sleep(3000 * (i + 1))
    }
  }
  throw last
}

export async function main() {
  const dir = findDir()
  const org = await local.organization.findFirstOrThrow({
    where: { name: { equals: ORG_NAME, mode: 'insensitive' } },
  })
  const ownerUser = await local.user.findFirstOrThrow({
    where: { email: { equals: 'deeqa@gmail.com', mode: 'insensitive' } },
    select: { id: true, name: true, email: true, image: true, isSystemOwner: true },
  })
  const organization = await local.organization.findUniqueOrThrow({ where: { id: org.id } })
  const { logoStorageKey, ...orgFields } = organization
  const ctx: OrgContext = {
    orgId: org.id,
    userId: ownerUser.id,
    role: 'OWNER',
    permissions: permissionsFor('OWNER'),
    isSystemOwner: ownerUser.isSystemOwner,
    canConnect: true,
    portalCustomerId: null,
    features: { ...DEFAULT_FEATURE_FLAGS, enableDocumentApprovals: false },
    organization: { ...orgFields, hasLogo: Boolean(logoStorageKey) },
    user: { id: ownerUser.id, name: ownerUser.name, email: ownerUser.email, image: ownerUser.image },
  }

  const registerAcct = (map: Map<string, string>, name: string, id: string) => {
    map.set(name.toLowerCase(), id)
    if (name.includes(':')) map.set(name.split(':').pop()!.trim().toLowerCase(), id)
  }
  const acctByName = new Map<string, string>()
  for (const a of await local.ledgerAccount.findMany({ where: { orgId: org.id } })) {
    registerAcct(acctByName, a.name, a.id)
  }
  const resolveAcct = (name: string, fallback?: string) =>
    acctByName.get(name.toLowerCase()) ||
    acctByName.get(name.split(':').pop()!.trim().toLowerCase()) ||
    (fallback ? acctByName.get(fallback.toLowerCase()) : undefined)

  const ar = await local.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, systemKey: 'ACCOUNTS_RECEIVABLE' },
  })
  const ap = await local.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, systemKey: 'ACCOUNTS_PAYABLE' },
  })
  registerAcct(acctByName, 'Accounts Receivable', ar.id)
  registerAcct(acctByName, 'Accounts Payable', ap.id)
  const salesId = resolveAcct('Sales')!
  const inventoryId =
    resolveAcct('Inventory Asset') ??
    (await local.ledgerAccount.findFirstOrThrow({ where: { orgId: org.id, systemKey: 'INVENTORY_ASSET' } })).id
  const cogsId =
    resolveAcct('Cost of Goods Sold') ??
    (await local.ledgerAccount.findFirstOrThrow({ where: { orgId: org.id, systemKey: 'COGS' } })).id
  const undepositedId =
    resolveAcct('Undeposited Funds') ??
    (await local.ledgerAccount.findFirstOrThrow({ where: { orgId: org.id, systemKey: 'UNDEPOSITED_FUNDS' } })).id
  const store =
    (await local.store.findFirst({ where: { orgId: org.id, isOffice: true } })) ??
    (await local.store.findFirstOrThrow({ where: { orgId: org.id } }))

  const customerMap = new Map(
    (await local.customer.findMany({ where: { orgId: org.id }, select: { id: true, displayName: true } })).map(
      (c) => [c.displayName.toLowerCase(), c.id] as const,
    ),
  )
  const vendorMap = new Map(
    (await local.vendor.findMany({ where: { orgId: org.id }, select: { id: true, displayName: true } })).map(
      (v) => [v.displayName.toLowerCase(), v.id] as const,
    ),
  )
  const itemMap = new Map(
    (await local.item.findMany({ where: { orgId: org.id }, select: { id: true, name: true } })).map(
      (i) => [i.name.toLowerCase(), i.id] as const,
    ),
  )
  const ensureCustomer = async (name: string) => {
    const k = name.toLowerCase()
    let id = customerMap.get(k)
    if (id) return id
    id = nid()
    await local.customer.create({
      data: { id, orgId: org.id, displayName: name, priceLevel: 'RETAIL', isActive: true },
    })
    customerMap.set(k, id)
    return id
  }
  const ensureVendor = async (name: string) => {
    const k = name.toLowerCase()
    let id = vendorMap.get(k)
    if (id) return id
    id = nid()
    await local.vendor.create({ data: { id, orgId: org.id, displayName: name, isActive: true } })
    vendorMap.set(k, id)
    return id
  }
  const ensureItem = async (name: string) => {
    const k = name.toLowerCase()
    let id = itemMap.get(k)
    if (id) return id
    id = nid()
    await local.item.create({
      data: {
        id,
        orgId: org.id,
        name,
        type: 'INVENTORY',
        salesPrice: '0',
        purchaseCost: '0',
        incomeAccountId: salesId,
        expenseAccountId: cogsId,
        inventoryAccountId: inventoryId,
        cogsAccountId: cogsId,
        isActive: true,
        isTaxable: false,
        availableInPos: true,
      },
    })
    itemMap.set(k, id)
    return id
  }

  const existingBillKeys = new Set(
    (
      await local.journal.findMany({
        where: { orgId: org.id, idempotencyKey: { startsWith: 'qb-bill-' } },
        select: { idempotencyKey: true },
      })
    )
      .map((j) => j.idempotencyKey)
      .filter(Boolean) as string[],
  )
  const existingJeKeys = new Set(
    (
      await local.journal.findMany({
        where: { orgId: org.id, idempotencyKey: { startsWith: 'qb-je-' } },
        select: { idempotencyKey: true },
      })
    )
      .map((j) => j.idempotencyKey)
      .filter(Boolean) as string[],
  )
  const existingPmtKeys = new Set(
    (
      await local.journal.findMany({
        where: { orgId: org.id, idempotencyKey: { startsWith: 'qb-pmt-' } },
        select: { idempotencyKey: true },
      })
    )
      .map((j) => j.idempotencyKey)
      .filter(Boolean) as string[],
  )
  const existingBpKeys = new Set(
    (
      await local.journal.findMany({
        where: { orgId: org.id, idempotencyKey: { startsWith: 'qb-bp-' } },
        select: { idempotencyKey: true },
      })
    )
      .map((j) => j.idempotencyKey)
      .filter(Boolean) as string[],
  )
  const usedBillNumbers = new Set(
    (await local.purchaseDocument.findMany({ where: { orgId: org.id }, select: { number: true } })).map((d) => d.number),
  )
  const usedPayNumbers = new Set(
    (await local.customerPayment.findMany({ where: { orgId: org.id }, select: { number: true } })).map((d) => d.number),
  )
  const usedBpNumbers = new Set(
    (await local.billPayment.findMany({ where: { orgId: org.id }, select: { number: true } })).map((d) => d.number),
  )
  const uniqueNo = (set: Set<string>, preferred: string, fallback: string) => {
    let n = preferred || fallback
    if (!n || set.has(n)) n = fallback
    let i = 2
    while (set.has(n)) n = `${fallback}-${i++}`
    set.add(n)
    return n
  }

  console.log('resume bills; have', existingBillKeys.size)
  let billN = 0
  for (const block of blocks(readAll(dir, 'bills'), 'BillRet')) {
    const txnId = tag(block, 'TxnID')
    const key = `qb-bill-${txnId || tag(block, 'RefNumber')}`
    if (existingBillKeys.has(key)) {
      bump('billExists')
      continue
    }
    const vendorName = refName(block, 'VendorRef')
    const date = tag(block, 'TxnDate')
    if (!vendorName || !date) {
      bump('billSkipped')
      continue
    }
    try {
      const vendorId = await ensureVendor(vendorName)
      const lineSpecs: {
        itemId?: string
        expenseAccountId?: string
        qty: string
        price: string
        desc: string | null
        amount: string
      }[] = []
      for (const line of blocks(block, 'ItemLineRet')) {
        const itemName = refName(line, 'ItemRef')
        if (!itemName) continue
        const qty = money(tag(line, 'Quantity') || '1')
        if (Number(qty) <= 0) continue
        const price = money(tag(line, 'Cost') || '0')
        const amount = money(tag(line, 'Amount') || String(Number(qty) * Number(price)))
        if (Number(amount) <= 0) continue
        lineSpecs.push({
          itemId: await ensureItem(itemName),
          qty,
          price,
          desc: tag(line, 'Desc') || null,
          amount,
        })
      }
      for (const line of blocks(block, 'ExpenseLineRet')) {
        const amount = money(tag(line, 'Amount') || '0')
        if (Number(amount) <= 0) continue
        const expName = refName(line, 'AccountRef')
        lineSpecs.push({
          expenseAccountId: (expName && resolveAcct(expName)) || inventoryId,
          qty: '1',
          price: amount,
          desc: tag(line, 'Memo') || null,
          amount,
        })
      }
      if (!lineSpecs.length) {
        bump('billNoLines')
        continue
      }
      const totalStr = money(String(lineSpecs.reduce((s, l) => s + Number(l.amount), 0)))
      const number = uniqueNo(usedBillNumbers, tag(block, 'RefNumber') || tag(block, 'TxnNumber'), `BILL-${txnId}`)
      const docId = nid()
      await withRetry(
        () =>
          db.$transaction(async (tx) => {
            const journal = await postJournal(tx, ctx, {
              date,
              memo: `Bill ${number}`,
              sourceType: 'BILL',
              sourceId: docId,
              idempotencyKey: key,
              lines: [
                { accountId: inventoryId, debit: totalStr, credit: '0', description: `Bill ${number}` },
                { accountId: ap.id, debit: '0', credit: totalStr, vendorId, description: `Bill ${number}` },
              ],
            })
            await tx.purchaseDocument.create({
              data: {
                id: docId,
                orgId: org.id,
                type: 'BILL',
                number,
                vendorId,
                date: new Date(`${date}T00:00:00.000Z`),
                status: 'OPEN',
                memo: tag(block, 'Memo') || null,
                subtotal: totalStr,
                total: totalStr,
                currencyCode: 'USD',
                journalId: journal.id,
                createdById: ctx.userId,
                lines: {
                  create: lineSpecs.map((l, i) => ({
                    orgId: org.id,
                    lineNumber: i + 1,
                    itemId: l.itemId ?? null,
                    expenseAccountId: l.expenseAccountId ?? null,
                    description: l.desc,
                    quantity: l.qty,
                    unitPrice: l.price,
                    amount: l.amount,
                    storeId: store.id,
                  })),
                },
              },
            })
          }),
        `bill ${number}`,
      )
      existingBillKeys.add(key)
      bump('bills')
      billN++
      if (billN % 25 === 0) console.log('  +bills', billN)
    } catch (e) {
      bump('billErrors')
      errors.push(`bill ${txnId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log('resume journals; have', existingJeKeys.size)
  const acctMeta = new Map(
    (await local.ledgerAccount.findMany({ where: { orgId: org.id }, select: { id: true, subtype: true } })).map(
      (a) => [a.id, a.subtype] as const,
    ),
  )
  let jeN = 0
  for (const block of blocks(readAll(dir, 'journals'), 'JournalEntryRet')) {
    const txnId = tag(block, 'TxnID')
    const key = `qb-je-${txnId || 'x'}`
    if (existingJeKeys.has(key)) {
      bump('journalExists')
      continue
    }
    const date = tag(block, 'TxnDate')
    if (!date) continue
    const lines: {
      accountId: string
      debit: string
      credit: string
      description: string
      customerId?: string
      vendorId?: string
    }[] = []
    const missing: string[] = []
    const addSide = async (line: string, side: 'debit' | 'credit') => {
      const name = refName(line, 'AccountRef')
      if (!name) return
      const accountId = resolveAcct(name)
      if (!accountId) {
        missing.push(name)
        return
      }
      const entity = refName(line, 'EntityRef')
      const subtype = acctMeta.get(accountId)
      const amt = money(tag(line, 'Amount') || '0')
      lines.push({
        accountId,
        debit: side === 'debit' ? amt : '0',
        credit: side === 'credit' ? amt : '0',
        description: tag(line, 'Memo') || '',
        customerId: subtype === 'ACCOUNTS_RECEIVABLE' ? await ensureCustomer(entity || 'QB Journal Customer') : undefined,
        vendorId: subtype === 'ACCOUNTS_PAYABLE' ? await ensureVendor(entity || 'QB Journal Vendor') : undefined,
      })
    }
    try {
      for (const line of blocks(block, 'JournalDebitLine')) await addSide(line, 'debit')
      for (const line of blocks(block, 'JournalCreditLine')) await addSide(line, 'credit')
      if (missing.length || lines.length < 2) {
        bump('journalSkipped')
        continue
      }
      await withRetry(
        () =>
          db.$transaction(async (tx) => {
            await postJournal(tx, ctx, {
              date,
              memo: tag(block, 'Memo') || undefined,
              sourceType: 'MANUAL',
              idempotencyKey: key,
              lines,
            })
          }),
        `je ${date}`,
      )
      existingJeKeys.add(key)
      bump('journals')
      jeN++
      if (jeN % 50 === 0) console.log('  +journals', jeN)
    } catch (e) {
      bump('journalErrors')
      errors.push(`je ${date}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log('payments')
  for (const block of blocks(readAll(dir, 'payments'), 'ReceivePaymentRet')) {
    const txnId = tag(block, 'TxnID')
    const key = `qb-pmt-${txnId}`
    if (existingPmtKeys.has(key)) {
      bump('paymentExists')
      continue
    }
    const customerName = refName(block, 'CustomerRef')
    const date = tag(block, 'TxnDate')
    const amount = money(tag(block, 'TotalAmount') || '0')
    if (!customerName || !date || Number(amount) <= 0) {
      bump('paymentSkipped')
      continue
    }
    try {
      const customerId = await ensureCustomer(customerName)
      const depositName = refName(block, 'DepositToAccountRef') || 'BANK'
      const depositId = resolveAcct(depositName) ?? undepositedId
      const payId = nid()
      const number = uniqueNo(
        usedPayNumbers,
        tag(block, 'RefNumber'),
        `PMT-${(txnId || payId).replace(/[^A-Za-z0-9]/g, '').slice(-10)}`,
      )
      await withRetry(
        () =>
          db.$transaction(async (tx) => {
            const journal = await postJournal(tx, ctx, {
              date,
              memo: `Payment ${tag(block, 'RefNumber') || ''}`.trim(),
              sourceType: 'CUSTOMER_PAYMENT',
              sourceId: payId,
              idempotencyKey: key,
              lines: [
                { accountId: depositId, debit: amount, credit: '0', description: 'Customer payment' },
                { accountId: ar.id, debit: '0', credit: amount, customerId, description: 'Customer payment' },
              ],
            })
            await tx.customerPayment.create({
              data: {
                id: payId,
                orgId: org.id,
                number,
                customerId,
                date: new Date(`${date}T00:00:00.000Z`),
                amount,
                method: 'OTHER',
                depositAccountId: depositId,
                currencyCode: 'USD',
                journalId: journal.id,
                status: 'OPEN',
                reference: tag(block, 'RefNumber') || null,
                createdById: ctx.userId,
              },
            })
          }),
        `pmt ${number}`,
      )
      existingPmtKeys.add(key)
      bump('payments')
    } catch (e) {
      bump('paymentErrors')
      errors.push(`pmt: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log('bill payments')
  const bpXml = readAll(dir, 'bill-payments')
  for (const kind of ['BillPaymentCheckRet', 'BillPaymentCreditCardRet']) {
    for (const block of blocks(bpXml, kind)) {
      const txnId = tag(block, 'TxnID')
      const key = `qb-bp-${txnId}`
      if (existingBpKeys.has(key)) {
        bump('billPaymentExists')
        continue
      }
      const vendorName = refName(block, 'PayeeEntityRef')
      const date = tag(block, 'TxnDate')
      const amount = money(tag(block, 'Amount') || '0')
      if (!vendorName || !date || Number(amount) <= 0) {
        bump('billPaymentSkipped')
        continue
      }
      try {
        const vendorId = await ensureVendor(vendorName)
        const bankName = refName(block, 'BankAccountRef') || refName(block, 'CreditCardAccountRef') || 'BANK'
        const bankId = resolveAcct(bankName) ?? resolveAcct('BANK')!
        const payId = nid()
        const number = uniqueNo(
          usedBpNumbers,
          tag(block, 'RefNumber'),
          `BP-${(txnId || payId).replace(/[^A-Za-z0-9]/g, '').slice(-10)}`,
        )
        await withRetry(
          () =>
            db.$transaction(async (tx) => {
              const journal = await postJournal(tx, ctx, {
                date,
                memo: `Bill payment ${tag(block, 'RefNumber') || ''}`.trim(),
                sourceType: 'BILL_PAYMENT',
                sourceId: payId,
                idempotencyKey: key,
                lines: [
                  { accountId: ap.id, debit: amount, credit: '0', vendorId, description: 'Bill payment' },
                  { accountId: bankId, debit: '0', credit: amount, description: 'Bill payment' },
                ],
              })
              await tx.billPayment.create({
                data: {
                  id: payId,
                  orgId: org.id,
                  number,
                  vendorId,
                  date: new Date(`${date}T00:00:00.000Z`),
                  amount,
                  method: 'OTHER',
                  paymentAccountId: bankId,
                  currencyCode: 'USD',
                  journalId: journal.id,
                  status: 'OPEN',
                  reference: tag(block, 'RefNumber') || null,
                  createdById: ctx.userId,
                },
              })
            }),
          `bp ${number}`,
        )
        existingBpKeys.add(key)
        bump('billPayments')
      } catch (e) {
        bump('billPaymentErrors')
        errors.push(`bp: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  console.log('inventory conversion')
  const ax = fs.readFileSync(path.join(dir, 'accounts.xml'), 'utf8')
  const hit = blocks(ax, 'AccountRet').find((b) => (tag(b, 'FullName') || tag(b, 'Name')) === 'Inventory Asset')
  const qbInv = Number(hit ? tag(hit, 'Balance') || '0' : '0')
  const invRow = await db.$queryRaw<{ debit: string; credit: string }[]>`
    SELECT COALESCE(SUM(CASE WHEN j.status NOT IN ('DRAFT','DELETED') THEN jl.debit ELSE 0 END), 0)::text AS debit,
           COALESCE(SUM(CASE WHEN j.status NOT IN ('DRAFT','DELETED') THEN jl.credit ELSE 0 END), 0)::text AS credit
    FROM journal_lines jl
    JOIN journals j ON j.id = jl."journalId"
    WHERE jl."orgId" = ${org.id} AND jl."accountId" = ${inventoryId}
  `
  const erpInv = Number(invRow[0]?.debit ?? 0) - Number(invRow[0]?.credit ?? 0)
  const invDiff = Number((erpInv - qbInv).toFixed(4))
  if (Math.abs(invDiff) > 0.01) {
    const amt = money(String(Math.abs(invDiff)))
    try {
      await withRetry(
        () =>
          db.$transaction(async (tx) => {
            await postJournal(tx, ctx, {
              date: '2026-11-02',
              memo: 'QB conversion: inventory to match QuickBooks',
              sourceType: 'OPENING_BALANCE',
              idempotencyKey: 'qb-inv-asset-conversion',
              lines:
                invDiff > 0
                  ? [
                      { accountId: cogsId, debit: amt, credit: '0', description: 'QB inventory conversion' },
                      { accountId: inventoryId, debit: '0', credit: amt, description: 'QB inventory conversion' },
                    ]
                  : [
                      { accountId: inventoryId, debit: amt, credit: '0', description: 'QB inventory conversion' },
                      { accountId: cogsId, debit: '0', credit: amt, description: 'QB inventory conversion' },
                    ],
            })
          }),
        'inv conv',
      )
      bump('inventoryConversion')
      console.log('  inventory plug', { erpInv, qbInv, invDiff })
    } catch (e) {
      bump('inventoryConversionErrors')
      errors.push(`inv conv: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const after = {
    customers: await local.customer.count({ where: { orgId: org.id } }),
    vendors: await local.vendor.count({ where: { orgId: org.id } }),
    items: await local.item.count({ where: { orgId: org.id } }),
    invoices: await local.salesDocument.count({ where: { orgId: org.id, type: 'INVOICE' } }),
    bills: await local.purchaseDocument.count({ where: { orgId: org.id, type: 'BILL' } }),
    journals: await local.journal.count({ where: { orgId: org.id } }),
    payments: await local.customerPayment.count({ where: { orgId: org.id } }),
    billPayments: await local.billPayment.count({ where: { orgId: org.id } }),
  }
  const report = { stats, after, errorCount: errors.length, errors: errors.slice(0, 80) }
  fs.writeFileSync(path.join(dir, 'migrate-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  await local.$disconnect()
}
