/**
 * Resume after timeout: skip wipe; import missing invoices/bills/journals/payments.
 * Run: pnpm exec vitest run scripts/qb-migrate-alfuraat/resume-bulk.test.ts
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
import { ensureFiscalYear } from '@/server/accounting/period'
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
const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1]!.trim() : ''
}
const blocks = (xml: string, name: string) => {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(m[1]!)
  return out
}
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

export async function main() {
  const dir = findDir()
  const org = await local.organization.findFirstOrThrow({
    where: { name: { equals: ORG_NAME, mode: 'insensitive' } },
  })
  console.log('Resume org', org.name, org.id)

  await db.$transaction(async (tx) => {
    for (let y = 2019; y <= 2027; y++) {
      await ensureFiscalYear(tx, org.id, org.fiscalYearStartMonth, y)
    }
  })

  const ar = await local.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, systemKey: 'ACCOUNTS_RECEIVABLE' },
  })
  const ap = await local.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, systemKey: 'ACCOUNTS_PAYABLE' },
  })
  const income = await local.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, OR: [{ name: 'Sales' }, { systemKey: 'UNCATEGORISED_INCOME' }] },
  })
  const expense = await local.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, systemKey: 'UNCATEGORISED_EXPENSE' },
  })
  const undeposited =
    (await local.ledgerAccount.findFirst({ where: { orgId: org.id, systemKey: 'UNDEPOSITED_FUNDS' } })) ??
    (await local.ledgerAccount.findFirstOrThrow({ where: { orgId: org.id, subtype: 'BANK' } }))
  const store =
    (await local.store.findFirst({ where: { orgId: org.id, isOffice: true } })) ??
    (await local.store.findFirstOrThrow({ where: { orgId: org.id } }))

  const membership = await local.membership.findFirstOrThrow({
    where: { orgId: org.id, status: 'ACTIVE' },
    select: { userId: true, role: true },
  })
  const user = await local.user.findFirstOrThrow({
    where: { id: membership.userId },
    select: { id: true, name: true, email: true, image: true, isSystemOwner: true },
  })
  const organization = await local.organization.findUniqueOrThrow({ where: { id: org.id } })
  const { logoStorageKey, ...orgFields } = organization
  const ctx: OrgContext = {
    orgId: org.id,
    userId: membership.userId,
    role: membership.role,
    permissions: permissionsFor(membership.role),
    isSystemOwner: user.isSystemOwner,
    canConnect: true,
    portalCustomerId: null,
    features: { ...DEFAULT_FEATURE_FLAGS, enableDocumentApprovals: false },
    organization: { ...orgFields, hasLogo: Boolean(logoStorageKey) },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
  }

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
  const existingInvoiceNumbers = new Set(
    (
      await local.salesDocument.findMany({
        where: { orgId: org.id, type: 'INVOICE' },
        select: { number: true },
      })
    ).map((d) => d.number),
  )
  const existingBillNumbers = new Set(
    (
      await local.purchaseDocument.findMany({
        where: { orgId: org.id, type: 'BILL' },
        select: { number: true },
      })
    ).map((d) => d.number),
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

  const ensureCustomer = async (name: string) => {
    const k = name.toLowerCase()
    let id = customerMap.get(k)
    if (id) return id
    id = nid()
    await local.customer.create({
      data: { id, orgId: org.id, displayName: name, priceLevel: 'RETAIL', isActive: true },
    })
    customerMap.set(k, id)
    bump('customersAuto')
    return id
  }
  const ensureVendor = async (name: string) => {
    const k = name.toLowerCase()
    let id = vendorMap.get(k)
    if (id) return id
    id = nid()
    await local.vendor.create({ data: { id, orgId: org.id, displayName: name, isActive: true } })
    vendorMap.set(k, id)
    bump('vendorsAuto')
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
        type: 'NON_INVENTORY',
        salesPrice: '0',
        purchaseCost: '0',
        incomeAccountId: income.id,
        expenseAccountId: expense.id,
        isActive: true,
        isTaxable: false,
        availableInPos: true,
      },
    })
    itemMap.set(k, id)
    bump('itemsAuto')
    return id
  }

  const invoiceIdByNumber = new Map(
    (
      await local.salesDocument.findMany({
        where: { orgId: org.id, type: 'INVOICE' },
        select: { id: true, number: true },
      })
    ).map((d) => [d.number, d.id] as const),
  )

  console.log('resume invoices; have', existingInvoiceNumbers.size)
  let invN = 0
  for (const block of blocks(readAll(dir, 'invoices'), 'InvoiceRet')) {
    const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
    if (!number || existingInvoiceNumbers.has(number)) {
      if (number && existingInvoiceNumbers.has(number)) bump('invoiceExists')
      continue
    }
    const customerName = tag(block.match(/<CustomerRef>[\s\S]*?<\/CustomerRef>/)?.[0] ?? '', 'FullName')
    const date = tag(block, 'TxnDate')
    if (!customerName || !date) {
      bump('invoiceSkipped')
      continue
    }
    try {
      const customerId = await ensureCustomer(customerName)
      const lineSpecs: { itemId: string; qty: string; price: string; desc: string | null; amount: string }[] = []
      for (const line of blocks(block, 'InvoiceLineRet')) {
        const itemName = tag(line.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName')
        if (!itemName) continue
        const qty = money(tag(line, 'Quantity') || '1')
        if (Number(qty) <= 0) continue
        const price = money(tag(line, 'Rate') || '0')
        const amount = money(tag(line, 'Amount') || String(Number(qty) * Number(price)))
        lineSpecs.push({
          itemId: await ensureItem(itemName),
          qty,
          price,
          desc: tag(line, 'Desc') || null,
          amount,
        })
      }
      if (!lineSpecs.length) {
        bump('invoiceNoLines')
        continue
      }
      const totalStr = money(String(lineSpecs.reduce((s, l) => s + Number(l.amount), 0)))
      const docId = nid()
      const isPaid = tag(block, 'IsPaid') === 'true'
      await db.$transaction(async (tx) => {
        const journal = await postJournal(tx, ctx, {
          date,
          memo: `Invoice ${number}`,
          sourceType: 'INVOICE',
          sourceId: docId,
          idempotencyKey: `qb-inv-${number}`,
          lines: [
            { accountId: ar.id, debit: totalStr, credit: '0', customerId, description: `Invoice ${number}` },
            { accountId: income.id, debit: '0', credit: totalStr, description: `Invoice ${number}` },
          ],
        })
        await tx.salesDocument.create({
          data: {
            id: docId,
            orgId: org.id,
            type: 'INVOICE',
            number,
            customerId,
            date: new Date(`${date}T00:00:00.000Z`),
            dueDate: tag(block, 'DueDate') ? new Date(`${tag(block, 'DueDate')}T00:00:00.000Z`) : null,
            status: isPaid ? 'PAID' : 'OPEN',
            reference: tag(block, 'PONumber') || null,
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
                itemId: l.itemId,
                description: l.desc,
                quantity: l.qty,
                unitPrice: l.price,
                amount: l.amount,
                incomeAccountId: income.id,
                storeId: store.id,
              })),
            },
          },
        })
      })
      invoiceIdByNumber.set(number, docId)
      existingInvoiceNumbers.add(number)
      bump('invoices')
      invN++
      if (invN % 25 === 0) console.log('  +invoices', invN, 'total', existingInvoiceNumbers.size)
    } catch (e) {
      bump('invoiceErrors')
      errors.push(`inv ${number}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log('resume bills; have', existingBillNumbers.size)
  let billN = 0
  for (const block of blocks(readAll(dir, 'bills'), 'BillRet')) {
    const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
    if (!number || existingBillNumbers.has(number)) {
      if (number && existingBillNumbers.has(number)) bump('billExists')
      continue
    }
    const vendorName = tag(block.match(/<VendorRef>[\s\S]*?<\/VendorRef>/)?.[0] ?? '', 'FullName')
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
        const itemName = tag(line.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName')
        if (!itemName) continue
        const qty = money(tag(line, 'Quantity') || '1')
        if (Number(qty) <= 0) continue
        const price = money(tag(line, 'Cost') || '0')
        lineSpecs.push({
          itemId: await ensureItem(itemName),
          qty,
          price,
          desc: tag(line, 'Desc') || null,
          amount: money(tag(line, 'Amount') || String(Number(qty) * Number(price))),
        })
      }
      for (const line of blocks(block, 'ExpenseLineRet')) {
        const amount = money(tag(line, 'Amount') || '0')
        if (Number(amount) <= 0) continue
        lineSpecs.push({
          expenseAccountId: expense.id,
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
      const docId = nid()
      await db.$transaction(async (tx) => {
        const journal = await postJournal(tx, ctx, {
          date,
          memo: `Bill ${number}`,
          sourceType: 'BILL',
          sourceId: docId,
          idempotencyKey: `qb-bill-${number}`,
          lines: [
            { accountId: expense.id, debit: totalStr, credit: '0', description: `Bill ${number}` },
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
      })
      existingBillNumbers.add(number)
      bump('bills')
      billN++
      if (billN % 25 === 0) console.log('  +bills', billN, 'total', existingBillNumbers.size)
    } catch (e) {
      bump('billErrors')
      errors.push(`bill ${number}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log('ensure QB ledger accounts')
  const qbTypeMap: Record<string, { type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'COGS' | 'EXPENSE'; subtype: string }> = {
    Bank: { type: 'ASSET', subtype: 'BANK' },
    AccountsReceivable: { type: 'ASSET', subtype: 'ACCOUNTS_RECEIVABLE' },
    OtherCurrentAsset: { type: 'ASSET', subtype: 'OTHER_CURRENT_ASSET' },
    FixedAsset: { type: 'ASSET', subtype: 'FIXED_ASSET' },
    OtherAsset: { type: 'ASSET', subtype: 'OTHER_ASSET' },
    AccountsPayable: { type: 'LIABILITY', subtype: 'ACCOUNTS_PAYABLE' },
    CreditCard: { type: 'LIABILITY', subtype: 'CREDIT_CARD' },
    OtherCurrentLiability: { type: 'LIABILITY', subtype: 'OTHER_CURRENT_LIABILITY' },
    LongTermLiability: { type: 'LIABILITY', subtype: 'LONG_TERM_LIABILITY' },
    Equity: { type: 'EQUITY', subtype: 'OWNERS_EQUITY' },
    Income: { type: 'REVENUE', subtype: 'INCOME' },
    OtherIncome: { type: 'REVENUE', subtype: 'OTHER_INCOME' },
    CostOfGoodsSold: { type: 'COGS', subtype: 'COST_OF_GOODS_SOLD' },
    Expense: { type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
    OtherExpense: { type: 'EXPENSE', subtype: 'OTHER_EXPENSE' },
    NonPosting: { type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  }
  const aliases: Record<string, string> = {
    'rent expense': 'Rent',
    sales: 'Sales — Plastic Products',
    'freight costs': 'Freight & Duty — Inbound',
    'payroll expenses': 'Salaries & Wages',
  }
  const acctByName = new Map<string, string>()
  const registerAcct = (name: string, id: string) => {
    acctByName.set(name.toLowerCase(), id)
    if (name.includes(':')) acctByName.set(name.split(':').pop()!.trim().toLowerCase(), id)
  }
  for (const a of await local.ledgerAccount.findMany({ where: { orgId: org.id } })) {
    registerAcct(a.name, a.id)
  }
  for (const [from, to] of Object.entries(aliases)) {
    const id = acctByName.get(to.toLowerCase())
    if (id) acctByName.set(from, id)
  }
  const usedCodes = new Set(
    (await local.ledgerAccount.findMany({ where: { orgId: org.id }, select: { code: true } })).map((a) => a.code),
  )
  let nextCode = 90000
  const allocCode = (preferred: string) => {
    if (preferred && !usedCodes.has(preferred)) {
      usedCodes.add(preferred)
      return preferred
    }
    while (usedCodes.has(String(nextCode))) nextCode++
    const c = String(nextCode++)
    usedCodes.add(c)
    return c
  }
  for (const block of blocks(fs.readFileSync(path.join(dir, 'accounts.xml'), 'utf8'), 'AccountRet')) {
    const full = tag(block, 'FullName') || tag(block, 'Name')
    if (!full) continue
    if (acctByName.has(full.toLowerCase())) continue
    const leaf = full.includes(':') ? full.split(':').pop()!.trim() : full
    if (acctByName.has(leaf.toLowerCase()) && !full.includes(':')) continue
    // Prefer exact full-name account for JE FullName lookup even when leaf exists
    if (acctByName.has(full.toLowerCase())) continue
    const qbType = tag(block, 'AccountType')
    const mapped = qbTypeMap[qbType] ?? { type: 'EXPENSE' as const, subtype: 'OPERATING_EXPENSE' }
    // Skip control accounts that already exist under standard names
    if (qbType === 'AccountsReceivable' || qbType === 'AccountsPayable') continue
    try {
      const id = nid()
      const code = allocCode(tag(block, 'AccountNumber'))
      await local.ledgerAccount.create({
        data: {
          id,
          orgId: org.id,
          code,
          name: full,
          type: mapped.type,
          subtype: mapped.subtype as never,
          isSystem: false,
          isActive: true,
        },
      })
      registerAcct(full, id)
      bump('accountsCreated')
    } catch (e) {
      bump('accountErrors')
      errors.push(`acct ${full}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  console.log('  accountsCreated', stats.accountsCreated ?? 0, 'mapSize', acctByName.size)

  console.log('resume journals')
  const acctMeta = new Map(
    (await local.ledgerAccount.findMany({ where: { orgId: org.id }, select: { id: true, subtype: true } })).map(
      (a) => [a.id, a.subtype] as const,
    ),
  )
  const resolveAcct = (name: string) =>
    acctByName.get(name.toLowerCase()) ||
    acctByName.get(name.split(':').pop()!.trim().toLowerCase()) ||
    acctByName.get(aliases[name.toLowerCase()]?.toLowerCase() ?? '')
  const buildJeLine = async (
    line: string,
    side: 'debit' | 'credit',
  ): Promise<
    | {
        accountId: string
        debit: string
        credit: string
        description: string
        customerId?: string
        vendorId?: string
      }
    | { missing: string }
    | null
  > => {
    const name = tag(line.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? '', 'FullName')
    if (!name) return null
    const accountId = resolveAcct(name)
    if (!accountId) return { missing: name }
    const entity = tag(line.match(/<EntityRef>[\s\S]*?<\/EntityRef>/)?.[0] ?? '', 'FullName')
    const subtype = acctMeta.get(accountId)
    let customerId: string | undefined
    let vendorId: string | undefined
    if (subtype === 'ACCOUNTS_RECEIVABLE') {
      customerId = await ensureCustomer(entity || 'QB Journal Customer')
    } else if (subtype === 'ACCOUNTS_PAYABLE') {
      vendorId = await ensureVendor(entity || 'QB Journal Vendor')
    }
    const amt = money(tag(line, 'Amount') || '0')
    return {
      accountId,
      debit: side === 'debit' ? amt : '0',
      credit: side === 'credit' ? amt : '0',
      description: tag(line, 'Memo') || '',
      customerId,
      vendorId,
    }
  }
  let jeN = 0
  for (const block of blocks(readAll(dir, 'journals'), 'JournalEntryRet')) {
    const txnId = tag(block, 'TxnID')
    const key = `qb-je-${txnId || 'x'}`
    if (txnId && existingJeKeys.has(key)) {
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
    const missingAccts: string[] = []
    try {
      for (const line of blocks(block, 'JournalDebitLine')) {
        const built = await buildJeLine(line, 'debit')
        if (!built) continue
        if ('missing' in built) {
          missingAccts.push(built.missing)
          continue
        }
        lines.push(built)
      }
      for (const line of blocks(block, 'JournalCreditLine')) {
        const built = await buildJeLine(line, 'credit')
        if (!built) continue
        if ('missing' in built) {
          missingAccts.push(built.missing)
          continue
        }
        lines.push(built)
      }
      if (missingAccts.length || lines.length < 2) {
        bump('journalSkipped')
        if (missingAccts.length && errors.length < 80) {
          errors.push(`je ${date} missing accts: ${[...new Set(missingAccts)].join(', ')}`)
        }
        continue
      }
      await db.$transaction(async (tx) => {
        await postJournal(tx, ctx, {
          date,
          memo: tag(block, 'Memo') || undefined,
          sourceType: 'MANUAL',
          idempotencyKey: key,
          lines,
        })
      })
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
  for (const block of blocks(readAll(dir, 'payments'), 'ReceivePaymentRet')) {
    const txnId = tag(block, 'TxnID')
    const key = `qb-pmt-${txnId || nid()}`
    if (existingPmtKeys.has(key)) {
      bump('paymentExists')
      continue
    }
    const customerName = tag(block.match(/<CustomerRef>[\s\S]*?<\/CustomerRef>/)?.[0] ?? '', 'FullName')
    const date = tag(block, 'TxnDate')
    const amount = money(tag(block, 'TotalAmount') || '0')
    const customerId = customerName ? customerMap.get(customerName.toLowerCase()) : undefined
    if (!customerId || !date || Number(amount) <= 0) {
      bump('paymentSkipped')
      continue
    }
    try {
      const payId = nid()
      await db.$transaction(async (tx) => {
        const journal = await postJournal(tx, ctx, {
          date,
          memo: `Payment ${tag(block, 'RefNumber') || ''}`.trim(),
          sourceType: 'CUSTOMER_PAYMENT',
          sourceId: payId,
          idempotencyKey: key,
          lines: [
            { accountId: undeposited.id, debit: amount, credit: '0', description: 'Customer payment' },
            { accountId: ar.id, debit: '0', credit: amount, customerId, description: 'Customer payment' },
          ],
        })
        const ref = tag(block, 'RefNumber')
        const number = `${ref || 'PMT'}-${(txnId || payId).replace(/[^A-Za-z0-9]/g, '').slice(-8)}`
        await tx.customerPayment.create({
          data: {
            id: payId,
            orgId: org.id,
            number,
            customerId,
            date: new Date(`${date}T00:00:00.000Z`),
            amount,
            method: 'OTHER',
            depositAccountId: undeposited.id,
            currencyCode: 'USD',
            journalId: journal.id,
            status: 'OPEN',
            reference: ref || null,
            createdById: ctx.userId,
          },
        })
      })
      bump('payments')
    } catch (e) {
      bump('paymentErrors')
      errors.push(`pmt: ${e instanceof Error ? e.message : String(e)}`)
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
  }
  const sample = await local.salesDocument.findFirst({
    where: { orgId: org.id, type: 'INVOICE' },
    include: { lines: { include: { item: { select: { name: true } } }, take: 10 } },
    orderBy: { number: 'asc' },
  })
  const report = {
    stats,
    after,
    qbTargets: { invoices: 503, bills: 848, journals: 795, payments: 47 },
    sample,
    errorCount: errors.length,
    errors: errors.slice(0, 120),
  }
  fs.writeFileSync(path.join(dir, 'migrate-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ stats, after, errorCount: errors.length, sampleNumber: sample?.number }, null, 2))
  await local.$disconnect()
}
