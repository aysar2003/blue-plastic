/**
 * Wipe AL FURAAT MATERIALS and re-import from QuickBooks with the same accounts
 * QB used (Sales, Inventory Asset, BANK, bill payments, journals).
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

const QB_TYPE: Record<
  string,
  { type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'COGS' | 'EXPENSE'; subtype: string }
> = {
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
}

export async function main() {
  const dir = findDir()
  console.log('dir', dir)
  const org = await local.organization.findFirst({
    where: { name: { equals: ORG_NAME, mode: 'insensitive' } },
  })
  if (!org) throw new Error('org missing')

  const ownerUser = await local.user.findFirst({
    where: { email: { equals: 'deeqa@gmail.com', mode: 'insensitive' } },
    select: { id: true, name: true, email: true, image: true, isSystemOwner: true },
  })
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
    data: {
      allowNegativeStock: true,
      featureFlags: { ...DEFAULT_FEATURE_FLAGS, enableDocumentApprovals: false },
    },
  })

  console.log('periods')
  await db.$transaction(async (tx) => {
    for (let y = 2019; y <= 2027; y++) {
      await ensureFiscalYear(tx, org.id, org.fiscalYearStartMonth, y)
    }
  })

  const registerAcct = (map: Map<string, string>, name: string, id: string) => {
    map.set(name.toLowerCase(), id)
    if (name.includes(':')) map.set(name.split(':').pop()!.trim().toLowerCase(), id)
  }
  const acctByName = new Map<string, string>()
  for (const a of await local.ledgerAccount.findMany({ where: { orgId: org.id } })) {
    registerAcct(acctByName, a.name, a.id)
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

  console.log('qb accounts')
  for (const block of blocks(fs.readFileSync(path.join(dir, 'accounts.xml'), 'utf8'), 'AccountRet')) {
    const full = tag(block, 'FullName') || tag(block, 'Name')
    if (!full) continue
    if (acctByName.has(full.toLowerCase())) continue
    const qbType = tag(block, 'AccountType')
    if (qbType === 'AccountsReceivable' || qbType === 'AccountsPayable') continue
    const mapped = QB_TYPE[qbType] ?? { type: 'EXPENSE' as const, subtype: 'OPERATING_EXPENSE' }
    const id = nid()
    await local.ledgerAccount.create({
      data: {
        id,
        orgId: org.id,
        code: allocCode(tag(block, 'AccountNumber')),
        name: full,
        type: mapped.type,
        subtype: mapped.subtype as never,
        isSystem: false,
        isActive: true,
      },
    })
    registerAcct(acctByName, full, id)
    bump('accountsCreated')
  }

  const requireAcct = (name: string) => {
    const id = acctByName.get(name.toLowerCase())
    if (!id) throw new Error(`missing account ${name}`)
    return id
  }
  const ar = await local.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, systemKey: 'ACCOUNTS_RECEIVABLE' },
  })
  const ap = await local.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, systemKey: 'ACCOUNTS_PAYABLE' },
  })
  registerAcct(acctByName, 'Accounts Receivable', ar.id)
  registerAcct(acctByName, 'Accounts Payable', ap.id)
  const salesId = requireAcct('Sales')
  const inventoryId =
    acctByName.get('inventory asset') ??
    (await local.ledgerAccount.findFirstOrThrow({ where: { orgId: org.id, systemKey: 'INVENTORY_ASSET' } })).id
  const cogsId =
    acctByName.get('cost of goods sold') ??
    (await local.ledgerAccount.findFirstOrThrow({ where: { orgId: org.id, systemKey: 'COGS' } })).id
  const undepositedId =
    acctByName.get('undeposited funds') ??
    (await local.ledgerAccount.findFirstOrThrow({ where: { orgId: org.id, systemKey: 'UNDEPOSITED_FUNDS' } })).id
  const resolveAcct = (name: string, fallback?: string) =>
    acctByName.get(name.toLowerCase()) ||
    acctByName.get(name.split(':').pop()!.trim().toLowerCase()) ||
    (fallback ? acctByName.get(fallback.toLowerCase()) : undefined)

  const store = await local.store.create({
    data: { orgId: org.id, name: 'Office', isOffice: true, inventoryAccountId: inventoryId },
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
    user: {
      id: ownerUser.id,
      name: ownerUser.name,
      email: ownerUser.email,
      image: ownerUser.image,
    },
  }

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
      if (!name || itemMap.has(name.toLowerCase())) continue
      const id = nid()
      itemMap.set(name.toLowerCase(), id)
      const incomeName = refName(b, 'IncomeAccountRef') || 'Sales'
      const cogsName = refName(b, 'COGSAccountRef') || 'Cost of Goods Sold'
      const assetName = refName(b, 'AssetAccountRef') || 'Inventory Asset'
      const isInv = type === 'INVENTORY'
      itemRows.push({
        id,
        orgId: org.id,
        name,
        type,
        salesPrice: money(tag(b, 'SalesPrice') || '0'),
        purchaseCost: money(tag(b, 'PurchaseCost') || tag(b, 'AverageCost') || '0'),
        incomeAccountId: resolveAcct(incomeName, 'Sales') ?? salesId,
        expenseAccountId: isInv ? (resolveAcct(cogsName) ?? cogsId) : (resolveAcct(cogsName) ?? cogsId),
        inventoryAccountId: isInv ? (resolveAcct(assetName) ?? inventoryId) : null,
        cogsAccountId: isInv ? (resolveAcct(cogsName) ?? cogsId) : null,
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
    bump('itemsAuto')
    return id
  }

  const usedInvoiceNumbers = new Set<string>()
  const usedBillNumbers = new Set<string>()
  const usedPayNumbers = new Set<string>()
  const usedBpNumbers = new Set<string>()
  const uniqueNo = (set: Set<string>, preferred: string, fallback: string) => {
    let n = preferred || fallback
    if (!n || set.has(n)) n = fallback
    let i = 2
    while (set.has(n)) n = `${fallback}-${i++}`
    set.add(n)
    return n
  }

  console.log('invoices')
  let invN = 0
  for (const block of blocks(readAll(dir, 'invoices'), 'InvoiceRet')) {
    const txnId = tag(block, 'TxnID')
    const number = uniqueNo(usedInvoiceNumbers, tag(block, 'RefNumber') || tag(block, 'TxnNumber'), `INV-${txnId}`)
    const customerName = refName(block, 'CustomerRef')
    const date = tag(block, 'TxnDate')
    if (!customerName || !date) {
      bump('invoiceSkipped')
      continue
    }
    try {
      const customerId = await ensureCustomer(customerName)
      const lineSpecs: { itemId: string; qty: string; price: string; desc: string | null; amount: string }[] = []
      for (const line of blocks(block, 'InvoiceLineRet')) {
        const itemName = refName(line, 'ItemRef')
        if (!itemName) continue
        const qty = money(tag(line, 'Quantity') || '1')
        if (Number(qty) <= 0) continue
        const price = money(tag(line, 'Rate') || '0')
        const amount = money(tag(line, 'Amount') || String(Number(qty) * Number(price)))
        if (Number(amount) === 0 && Number(qty) === 0) continue
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
      if (Number(totalStr) <= 0) {
        bump('invoiceZero')
        continue
      }
      const docId = nid()
      const isPaid = tag(block, 'IsPaid') === 'true'
      await db.$transaction(async (tx) => {
        const journal = await postJournal(tx, ctx, {
          date,
          memo: `Invoice ${number}`,
          sourceType: 'INVOICE',
          sourceId: docId,
          idempotencyKey: `qb-inv-${txnId || number}`,
          lines: [
            { accountId: ar.id, debit: totalStr, credit: '0', customerId, description: `Invoice ${number}` },
            { accountId: salesId, debit: '0', credit: totalStr, description: `Invoice ${number}` },
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
                incomeAccountId: salesId,
                storeId: store.id,
              })),
            },
          },
        })
      })
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
    const txnId = tag(block, 'TxnID')
    const number = uniqueNo(usedBillNumbers, tag(block, 'RefNumber') || tag(block, 'TxnNumber'), `BILL-${txnId}`)
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
      const docId = nid()
      await db.$transaction(async (tx) => {
        const journal = await postJournal(tx, ctx, {
          date,
          memo: `Bill ${number}`,
          sourceType: 'BILL',
          sourceId: docId,
          idempotencyKey: `qb-bill-${txnId || number}`,
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
  const acctMeta = new Map(
    (await local.ledgerAccount.findMany({ where: { orgId: org.id }, select: { id: true, subtype: true } })).map(
      (a) => [a.id, a.subtype] as const,
    ),
  )
  let jeN = 0
  for (const block of blocks(readAll(dir, 'journals'), 'JournalEntryRet')) {
    const txnId = tag(block, 'TxnID')
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
        if (missing.length && errors.length < 40) errors.push(`je ${date} missing ${[...new Set(missing)].join(', ')}`)
        continue
      }
      await db.$transaction(async (tx) => {
        await postJournal(tx, ctx, {
          date,
          memo: tag(block, 'Memo') || undefined,
          sourceType: 'MANUAL',
          idempotencyKey: `qb-je-${txnId || `${date}-${jeN}`}`,
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
    const txnId = tag(block, 'TxnID')
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
      await db.$transaction(async (tx) => {
        const journal = await postJournal(tx, ctx, {
          date,
          memo: `Payment ${tag(block, 'RefNumber') || ''}`.trim(),
          sourceType: 'CUSTOMER_PAYMENT',
          sourceId: payId,
          idempotencyKey: `qb-pmt-${txnId || payId}`,
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
      })
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
        const bankId = resolveAcct(bankName) ?? requireAcct('BANK')
        const payId = nid()
        const number = uniqueNo(
          usedBpNumbers,
          tag(block, 'RefNumber'),
          `BP-${(txnId || payId).replace(/[^A-Za-z0-9]/g, '').slice(-10)}`,
        )
        await db.$transaction(async (tx) => {
          const journal = await postJournal(tx, ctx, {
            date,
            memo: `Bill payment ${tag(block, 'RefNumber') || ''}`.trim(),
            sourceType: 'BILL_PAYMENT',
            sourceId: payId,
            idempotencyKey: `qb-bp-${txnId || payId}`,
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
        })
        bump('billPayments')
      } catch (e) {
        bump('billPaymentErrors')
        errors.push(`bp: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  console.log('inventory conversion to match QB Inventory Asset')
  const qbInv = (() => {
    const ax = fs.readFileSync(path.join(dir, 'accounts.xml'), 'utf8')
    const hit = blocks(ax, 'AccountRet').find((b) => (tag(b, 'FullName') || tag(b, 'Name')) === 'Inventory Asset')
    return Number(hit ? tag(hit, 'Balance') || '0' : '0')
  })()
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
    const date = '2026-11-02'
    const amt = money(String(Math.abs(invDiff)))
    try {
      await db.$transaction(async (tx) => {
        await postJournal(tx, ctx, {
          date,
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
      })
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
