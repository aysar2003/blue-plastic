/**
 * Bulk QB → AL FURAAT MATERIALS: lists + invoice/bill lines + AR/AP journals (no stock trail).
 * Faster than sales.service per doc. Run via vitest migrate-bulk.test.ts
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
import { wipeCompanyBooks } from '@/server/company-wipe'
import { seedChartOfAccounts } from '@/server/accounting/chart-of-accounts'
import { createDefaultSequences } from '@/server/sequences'
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
  console.log('dir', dir)
  const org = await local.organization.findFirst({
    where: { name: { equals: ORG_NAME, mode: 'insensitive' } },
  })
  if (!org) throw new Error('org missing')

  const ownerUser =
    (await local.user.findFirst({ where: { email: { equals: 'deeqa@gmail.com', mode: 'insensitive' } } })) ??
    (await local.user.findFirst({ where: { isSystemOwner: true } }))
  if (!ownerUser) throw new Error('no owner')

  console.log('wipe')
  await local.$transaction(async (tx) => wipeCompanyBooks(tx as never, org.id), { timeout: 180_000 })

  console.log('seed')
  await local.$transaction(async (tx) => {
    await createDefaultSequences(tx as never, org.id)
    await seedChartOfAccounts(tx as never, org.id)
    await tx.membership.create({
      data: {
        orgId: org.id,
        userId: ownerUser.id,
        role: 'OWNER',
        status: 'ACTIVE',
        acceptedAt: new Date(),
        canConnect: true,
      },
    })
  })
  await local.organization.update({
    where: { id: org.id },
    data: { allowNegativeStock: true, featureFlags: { ...DEFAULT_FEATURE_FLAGS, enableDocumentApprovals: false } },
  })

  // fiscal years 2019–2027
  console.log('periods')
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
  const cogs = await local.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, systemKey: 'COGS' },
  })
  const inventory = await local.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, systemKey: 'INVENTORY_ASSET' },
  })
  const undeposited =
    (await local.ledgerAccount.findFirst({ where: { orgId: org.id, systemKey: 'UNDEPOSITED_FUNDS' } })) ??
    (await local.ledgerAccount.findFirstOrThrow({ where: { orgId: org.id, subtype: 'BANK' } }))

  const store = await local.store.create({
    data: { orgId: org.id, name: 'Office', isOffice: true, inventoryAccountId: inventory.id },
  })

  const organization = await local.organization.findUniqueOrThrow({ where: { id: org.id } })
  const membership = await local.membership.findFirstOrThrow({
    where: { orgId: org.id },
    include: { user: true },
  })
  const { logoStorageKey, ...orgFields } = organization
  const ctx: OrgContext = {
    orgId: org.id,
    userId: membership.userId,
    role: membership.role,
    permissions: permissionsFor(membership.role),
    isSystemOwner: membership.user.isSystemOwner,
    canConnect: true,
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

  // customers
  console.log('customers')
  const customerMap = new Map<string, string>()
  const custData = blocks(readAll(dir, 'customers'), 'CustomerRet')
    .map((b) => {
      const name = tag(b, 'FullName') || tag(b, 'Name')
      if (!name) return null
      const id = nid()
      customerMap.set(name.toLowerCase(), id)
      return {
        id,
        orgId: org.id,
        displayName: name,
        phone: tag(b, 'Phone') || null,
        billingLine1: tag(b, 'Addr1') || null,
        priceLevel: 'RETAIL' as const,
        isActive: true,
      }
    })
    .filter(Boolean) as {
    id: string
    orgId: string
    displayName: string
    phone: string | null
    billingLine1: string | null
    priceLevel: 'RETAIL'
    isActive: boolean
  }[]
  await local.customer.createMany({ data: custData })
  bump('customers', custData.length)

  const vendorMap = new Map<string, string>()
  const vendData = blocks(readAll(dir, 'vendors'), 'VendorRet')
    .map((b) => {
      const name = tag(b, 'FullName') || tag(b, 'Name')
      if (!name) return null
      const id = nid()
      vendorMap.set(name.toLowerCase(), id)
      return { id, orgId: org.id, displayName: name, phone: tag(b, 'Phone') || null, isActive: true }
    })
    .filter(Boolean) as { id: string; orgId: string; displayName: string; phone: string | null; isActive: boolean }[]
  await local.vendor.createMany({ data: vendData })
  bump('vendors', vendData.length)

  console.log('items')
  const itemMap = new Map<string, string>()
  const itemXml = readAll(dir, 'items')
  const itemRows: {
    id: string
    orgId: string
    name: string
    type: 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE' | 'OTHER_CHARGE' | 'DISCOUNT'
    salesPrice: string
    purchaseCost: string
    incomeAccountId: string
    expenseAccountId: string
    inventoryAccountId: string | null
    cogsAccountId: string | null
    salesDescription: string | null
    isActive: boolean
    isTaxable: boolean
    availableInPos: boolean
  }[] = []
  const addItems = (kind: string, type: (typeof itemRows)[0]['type']) => {
    for (const b of blocks(itemXml, kind)) {
      const name = tag(b, 'FullName') || tag(b, 'Name')
      if (!name || name.includes(':') || itemMap.has(name.toLowerCase())) continue
      const id = nid()
      itemMap.set(name.toLowerCase(), id)
      itemRows.push({
        id,
        orgId: org.id,
        name,
        type,
        salesPrice: money(tag(b, 'SalesPrice') || '0'),
        purchaseCost: money(tag(b, 'PurchaseCost') || '0'),
        incomeAccountId: income.id,
        expenseAccountId: type === 'INVENTORY' ? cogs.id : expense.id,
        inventoryAccountId: type === 'INVENTORY' ? inventory.id : null,
        cogsAccountId: type === 'INVENTORY' ? cogs.id : null,
        salesDescription: tag(b, 'SalesDesc') || null,
        isActive: true,
        isTaxable: false,
        availableInPos: true,
      })
    }
  }
  addItems('ItemInventoryRet', 'INVENTORY')
  addItems('ItemNonInventoryRet', 'NON_INVENTORY')
  addItems('ItemServiceRet', 'SERVICE')
  addItems('ItemOtherChargeRet', 'OTHER_CHARGE')
  addItems('ItemDiscountRet', 'DISCOUNT')
  for (let i = 0; i < itemRows.length; i += 300) {
    await local.item.createMany({ data: itemRows.slice(i, i + 300) })
  }
  bump('items', itemRows.length)
  console.log('items', itemRows.length)

  const ensureCustomer = async (name: string) => {
    const k = name.toLowerCase()
    let id = customerMap.get(k)
    if (id) return id
    id = nid()
    await local.customer.create({ data: { id, orgId: org.id, displayName: name, priceLevel: 'RETAIL', isActive: true } })
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
    return id
  }

  const invoiceIdByNumber = new Map<string, string>()

  console.log('invoices')
  let invN = 0
  for (const block of blocks(readAll(dir, 'invoices'), 'InvoiceRet')) {
    const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
    const customerName = tag(block.match(/<CustomerRef>[\s\S]*?<\/CustomerRef>/)?.[0] ?? '', 'FullName')
    const date = tag(block, 'TxnDate')
    if (!number || !customerName || !date) {
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
      const total = lineSpecs.reduce((s, l) => s + Number(l.amount), 0)
      const totalStr = money(String(total))
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
            date: new Date(date + 'T00:00:00.000Z'),
            dueDate: tag(block, 'DueDate') ? new Date(tag(block, 'DueDate') + 'T00:00:00.000Z') : null,
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
      bump('invoices')
      invN++
      if (invN % 50 === 0) console.log('  invoices', invN)
    } catch (e) {
      bump('invoiceErrors')
      errors.push(`inv ${number}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log('bills')
  let billN = 0
  for (const block of blocks(readAll(dir, 'bills'), 'BillRet')) {
    const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
    const vendorName = tag(block.match(/<VendorRef>[\s\S]*?<\/VendorRef>/)?.[0] ?? '', 'FullName')
    const date = tag(block, 'TxnDate')
    if (!number || !vendorName || !date) {
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
      const total = lineSpecs.reduce((s, l) => s + Number(l.amount), 0)
      const totalStr = money(String(total))
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
            date: new Date(date + 'T00:00:00.000Z'),
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
      bump('bills')
      billN++
      if (billN % 50 === 0) console.log('  bills', billN)
    } catch (e) {
      bump('billErrors')
      errors.push(`bill ${number}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log('journals')
  const acctByName = new Map(
    (await local.ledgerAccount.findMany({ where: { orgId: org.id } })).map((a) => [a.name.toLowerCase(), a.id]),
  )
  let jeN = 0
  for (const block of blocks(readAll(dir, 'journals'), 'JournalEntryRet')) {
    const date = tag(block, 'TxnDate')
    if (!date) continue
    const lines: { accountId: string; debit: string; credit: string; description: string }[] = []
    for (const line of blocks(block, 'JournalDebitLine')) {
      const name = tag(line.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? '', 'FullName')
      const accountId = name ? acctByName.get(name.toLowerCase()) : undefined
      if (!accountId) continue
      lines.push({ accountId, debit: money(tag(line, 'Amount') || '0'), credit: '', description: tag(line, 'Memo') || '' })
    }
    for (const line of blocks(block, 'JournalCreditLine')) {
      const name = tag(line.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? '', 'FullName')
      const accountId = name ? acctByName.get(name.toLowerCase()) : undefined
      if (!accountId) continue
      lines.push({ accountId, debit: '', credit: money(tag(line, 'Amount') || '0'), description: tag(line, 'Memo') || '' })
    }
    if (lines.length < 2) {
      bump('journalSkipped')
      continue
    }
    try {
      await db.$transaction(async (tx) => {
        await postJournal(tx, ctx, {
          date,
          memo: tag(block, 'Memo') || undefined,
          sourceType: 'MANUAL',
          journalNumber: tag(block, 'RefNumber') || undefined,
          idempotencyKey: `qb-je-${tag(block, 'TxnID') || `${date}-${jeN}`}`,
          lines,
        })
      })
      bump('journals')
      jeN++
      if (jeN % 50 === 0) console.log('  journals', jeN)
    } catch (e) {
      bump('journalErrors')
      errors.push(`je ${date}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log('payments')
  for (const block of blocks(readAll(dir, 'payments'), 'ReceivePaymentRet')) {
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
          idempotencyKey: `qb-pmt-${tag(block, 'TxnID') || payId}`,
          lines: [
            { accountId: undeposited.id, debit: amount, credit: '0', description: 'Customer payment' },
            { accountId: ar.id, debit: '0', credit: amount, customerId, description: 'Customer payment' },
          ],
        })
        await tx.customerPayment.create({
          data: {
            id: payId,
            orgId: org.id,
            number: tag(block, 'RefNumber') || `PMT-${payId.slice(-6)}`,
            customerId,
            date: new Date(date + 'T00:00:00.000Z'),
            amount,
            method: 'OTHER',
            depositAccountId: undeposited.id,
            currencyCode: 'USD',
            journalId: journal.id,
            status: 'OPEN',
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
  const report = { stats, after, sample, errorCount: errors.length, errors: errors.slice(0, 120) }
  fs.writeFileSync(path.join(dir, 'migrate-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ stats, after, errorCount: errors.length, sampleNumber: sample?.number }, null, 2))
  await local.$disconnect()
}
