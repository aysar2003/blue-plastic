/**
 * Wipe AL FURAAT MATERIALS and post QuickBooks AccountRet balances as the ledger
 * so the Balance Sheet matches QB as of the export. Documents are imported
 * without posting so they do not change those balances.
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
const CONV_DATE = '2026-11-02'
const EXPORT_DIRS = [
  path.join(process.env.USERPROFILE ?? 'C:\\Users\\Zmart', 'Desktop', 'qb-alfuraat-export'),
  'C:\\Users\\Zmart\\qb-export',
]

const local = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! }),
  transactionOptions: { maxWait: 60_000, timeout: 180_000 },
})

const nid = () => `c${randomBytes(12).toString('hex')}`
const decode = (s: string) =>
  s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
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
const money = (n: number) => String(Number(n.toFixed(4)))
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
  { type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'COGS' | 'EXPENSE'; subtype: string; debitNormal: boolean }
> = {
  Bank: { type: 'ASSET', subtype: 'BANK', debitNormal: true },
  AccountsReceivable: { type: 'ASSET', subtype: 'ACCOUNTS_RECEIVABLE', debitNormal: true },
  OtherCurrentAsset: { type: 'ASSET', subtype: 'OTHER_CURRENT_ASSET', debitNormal: true },
  FixedAsset: { type: 'ASSET', subtype: 'FIXED_ASSET', debitNormal: true },
  OtherAsset: { type: 'ASSET', subtype: 'OTHER_ASSET', debitNormal: true },
  AccountsPayable: { type: 'LIABILITY', subtype: 'ACCOUNTS_PAYABLE', debitNormal: false },
  CreditCard: { type: 'LIABILITY', subtype: 'CREDIT_CARD', debitNormal: false },
  OtherCurrentLiability: { type: 'LIABILITY', subtype: 'OTHER_CURRENT_LIABILITY', debitNormal: false },
  LongTermLiability: { type: 'LIABILITY', subtype: 'LONG_TERM_LIABILITY', debitNormal: false },
  Equity: { type: 'EQUITY', subtype: 'OWNERS_EQUITY', debitNormal: false },
  Income: { type: 'REVENUE', subtype: 'INCOME', debitNormal: false },
  OtherIncome: { type: 'REVENUE', subtype: 'OTHER_INCOME', debitNormal: false },
  CostOfGoodsSold: { type: 'COGS', subtype: 'COST_OF_GOODS_SOLD', debitNormal: true },
  Expense: { type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', debitNormal: true },
  OtherExpense: { type: 'EXPENSE', subtype: 'OTHER_EXPENSE', debitNormal: true },
}

type DraftLine = {
  accountId: string
  debit: string
  credit: string
  description: string
  customerId?: string
  vendorId?: string
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
  await db.$transaction(async (tx) => {
    for (let y = 2019; y <= 2027; y++) await ensureFiscalYear(tx, org.id, org.fiscalYearStartMonth, y)
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

  const ax = fs.readFileSync(path.join(dir, 'accounts.xml'), 'utf8')
  for (const block of blocks(ax, 'AccountRet')) {
    const full = tag(block, 'FullName') || tag(block, 'Name')
    if (!full || acctByName.has(full.toLowerCase())) continue
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
  }

  const ar = await local.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, systemKey: 'ACCOUNTS_RECEIVABLE' },
  })
  const ap = await local.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, systemKey: 'ACCOUNTS_PAYABLE' },
  })
  registerAcct(acctByName, 'Accounts Receivable', ar.id)
  registerAcct(acctByName, 'Accounts Payable', ap.id)
  const inventoryId =
    acctByName.get('inventory asset') ??
    (await local.ledgerAccount.findFirstOrThrow({ where: { orgId: org.id, systemKey: 'INVENTORY_ASSET' } })).id
  const salesId = acctByName.get('sales')!
  const cogsId =
    acctByName.get('cost of goods sold') ??
    (await local.ledgerAccount.findFirstOrThrow({ where: { orgId: org.id, systemKey: 'COGS' } })).id

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
    user: { id: ownerUser.id, name: ownerUser.name, email: ownerUser.email, image: ownerUser.image },
  }

  const customerMap = new Map<string, string>()
  const custRows = blocks(readAll(dir, 'customers'), 'CustomerRet')
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
        priceLevel: 'RETAIL' as const,
        isActive: true,
        _bal: Number(tag(b, 'Balance') || 0),
      }
    })
    .filter(Boolean) as { id: string; orgId: string; displayName: string; phone: string | null; priceLevel: 'RETAIL'; isActive: boolean; _bal: number }[]
  await local.customer.createMany({
    data: custRows.map(({ _bal, ...row }) => row),
  })

  const vendorMap = new Map<string, string>()
  const vendRows = blocks(readAll(dir, 'vendors'), 'VendorRet')
    .map((b) => {
      const name = tag(b, 'FullName') || tag(b, 'Name')
      if (!name) return null
      const id = nid()
      vendorMap.set(name.toLowerCase(), id)
      return { id, orgId: org.id, displayName: name, phone: tag(b, 'Phone') || null, isActive: true, _bal: Number(tag(b, 'Balance') || 0) }
    })
    .filter(Boolean) as { id: string; orgId: string; displayName: string; phone: string | null; isActive: boolean; _bal: number }[]
  await local.vendor.createMany({
    data: vendRows.map(({ _bal, ...row }) => row),
  })

  const itemMap = new Map<string, string>()
  const itemXml = readAll(dir, 'items')
  const itemRows: {
    id: string
    orgId: string
    name: string
    type: 'INVENTORY' | 'DISCOUNT'
    salesPrice: string
    purchaseCost: string
    incomeAccountId: string
    expenseAccountId: string
    inventoryAccountId: string | null
    cogsAccountId: string | null
    isActive: boolean
    isTaxable: boolean
    availableInPos: boolean
  }[] = []
  for (const kind of ['ItemInventoryRet', 'ItemDiscountRet'] as const) {
    for (const b of blocks(itemXml, kind)) {
      const name = tag(b, 'FullName') || tag(b, 'Name')
      if (!name || itemMap.has(name.toLowerCase())) continue
      const id = nid()
      itemMap.set(name.toLowerCase(), id)
      const isInv = kind === 'ItemInventoryRet'
      itemRows.push({
        id,
        orgId: org.id,
        name,
        type: isInv ? 'INVENTORY' : 'DISCOUNT',
        salesPrice: money(Number(tag(b, 'SalesPrice') || 0)),
        purchaseCost: money(Number(tag(b, 'PurchaseCost') || tag(b, 'AverageCost') || 0)),
        incomeAccountId: salesId,
        expenseAccountId: cogsId,
        inventoryAccountId: isInv ? inventoryId : null,
        cogsAccountId: isInv ? cogsId : null,
        isActive: true,
        isTaxable: false,
        availableInPos: true,
      })
    }
  }
  for (let i = 0; i < itemRows.length; i += 300) {
    await local.item.createMany({ data: itemRows.slice(i, i + 300) })
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

  console.log('post QB trial balance')
  const lines: DraftLine[] = []
  const pushAmt = (accountId: string, natural: number, debitNormal: boolean, desc: string, extra?: { customerId?: string; vendorId?: string }) => {
    if (Math.abs(natural) < 0.005) return
    const amt = money(Math.abs(natural))
    const debitSide = debitNormal ? natural > 0 : natural < 0
    lines.push({
      accountId,
      debit: debitSide ? amt : '0',
      credit: debitSide ? '0' : amt,
      description: desc,
      ...extra,
    })
  }

  for (const c of custRows) {
    pushAmt(ar.id, c._bal, true, `QB AR ${c.displayName}`, { customerId: c.id })
  }
  for (const v of vendRows) {
    pushAmt(ap.id, v._bal, false, `QB AP ${v.displayName}`, { vendorId: v.id })
  }

  for (const block of blocks(ax, 'AccountRet')) {
    const full = tag(block, 'FullName') || tag(block, 'Name')
    const qbType = tag(block, 'AccountType')
    if (!full || qbType === 'AccountsReceivable' || qbType === 'AccountsPayable') continue
    const mapped = QB_TYPE[qbType]
    if (!mapped) continue
    const accountId = acctByName.get(full.toLowerCase())
    if (!accountId) {
      console.log('skip missing', full)
      continue
    }
    pushAmt(accountId, Number(tag(block, 'Balance') || 0), mapped.debitNormal, `QB ${full}`)
  }

  const dr = lines.reduce((s, l) => s + Number(l.debit), 0)
  const cr = lines.reduce((s, l) => s + Number(l.credit), 0)
  const diff = Number((dr - cr).toFixed(4))
  if (Math.abs(diff) > 0.01) {
    const rounding = await local.ledgerAccount.findFirstOrThrow({
      where: { orgId: org.id, systemKey: 'ROUNDING_DIFFERENCE' },
    })
    pushAmt(rounding.id, -diff, true, 'QB conversion rounding')
  }
  console.log('TB lines', lines.length, 'dr', dr, 'cr', cr, 'diff', diff)

  await db.$transaction(async (tx) => {
    await postJournal(tx, ctx, {
      date: CONV_DATE,
      memo: 'QuickBooks conversion — trial balance as of export',
      sourceType: 'OPENING_BALANCE',
      idempotencyKey: 'qb-tb-conversion',
      lines,
    })
  })

  console.log('documents (no posting)')
  const usedInv = new Set<string>()
  let invN = 0
  for (const block of blocks(readAll(dir, 'invoices'), 'InvoiceRet')) {
    const txnId = tag(block, 'TxnID')
    let number = tag(block, 'RefNumber') || tag(block, 'TxnNumber') || `INV-${txnId}`
    if (usedInv.has(number)) number = `INV-${txnId}`
    usedInv.add(number)
    const customerName = refName(block, 'CustomerRef')
    const date = tag(block, 'TxnDate')
    const customerId = customerName ? customerMap.get(customerName.toLowerCase()) : undefined
    if (!customerId || !date) continue
    const lineSpecs: { itemId: string; qty: string; price: string; desc: string | null; amount: string }[] = []
    for (const line of blocks(block, 'InvoiceLineRet')) {
      const itemName = refName(line, 'ItemRef')
      if (!itemName) continue
      const qty = money(Number(tag(line, 'Quantity') || 0) || 1)
      if (Number(qty) <= 0) continue
      const amount = money(Number(tag(line, 'Amount') || 0))
      if (Number(amount) <= 0) continue
      lineSpecs.push({
        itemId: await ensureItem(itemName),
        qty,
        price: money(Number(tag(line, 'Rate') || 0)),
        desc: tag(line, 'Desc') || null,
        amount,
      })
    }
    if (!lineSpecs.length) continue
    const totalStr = money(lineSpecs.reduce((s, l) => s + Number(l.amount), 0))
    await local.salesDocument.create({
      data: {
        id: nid(),
        orgId: org.id,
        type: 'INVOICE',
        number,
        customerId,
        date: new Date(`${date}T00:00:00.000Z`),
        status: 'PAID',
        subtotal: totalStr,
        total: totalStr,
        currencyCode: 'USD',
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
    invN++
    if (invN % 100 === 0) console.log('  invoices', invN)
  }

  const usedBill = new Set<string>()
  let billN = 0
  for (const block of blocks(readAll(dir, 'bills'), 'BillRet')) {
    const txnId = tag(block, 'TxnID')
    let number = tag(block, 'RefNumber') || tag(block, 'TxnNumber') || `BILL-${txnId}`
    if (usedBill.has(number)) number = `BILL-${txnId}`
    usedBill.add(number)
    const vendorName = refName(block, 'VendorRef')
    const date = tag(block, 'TxnDate')
    const vendorId = vendorName ? vendorMap.get(vendorName.toLowerCase()) : undefined
    if (!vendorId || !date) continue
    const lineSpecs: { itemId?: string; qty: string; price: string; desc: string | null; amount: string }[] = []
    for (const line of blocks(block, 'ItemLineRet')) {
      const itemName = refName(line, 'ItemRef')
      if (!itemName) continue
      const qty = money(Number(tag(line, 'Quantity') || 0) || 1)
      if (Number(qty) <= 0) continue
      const amount = money(Number(tag(line, 'Amount') || 0))
      if (Number(amount) <= 0) continue
      lineSpecs.push({
        itemId: await ensureItem(itemName),
        qty,
        price: money(Number(tag(line, 'Cost') || 0)),
        desc: tag(line, 'Desc') || null,
        amount,
      })
    }
    if (!lineSpecs.length) continue
    const totalStr = money(lineSpecs.reduce((s, l) => s + Number(l.amount), 0))
    await local.purchaseDocument.create({
      data: {
        id: nid(),
        orgId: org.id,
        type: 'BILL',
        number,
        vendorId,
        date: new Date(`${date}T00:00:00.000Z`),
        status: 'PAID',
        subtotal: totalStr,
        total: totalStr,
        currencyCode: 'USD',
        createdById: ctx.userId,
        lines: {
          create: lineSpecs.map((l, i) => ({
            orgId: org.id,
            lineNumber: i + 1,
            itemId: l.itemId ?? null,
            description: l.desc,
            quantity: l.qty,
            unitPrice: l.price,
            amount: l.amount,
            storeId: store.id,
          })),
        },
      },
    })
    billN++
    if (billN % 100 === 0) console.log('  bills', billN)
  }

  const after = {
    customers: await local.customer.count({ where: { orgId: org.id } }),
    vendors: await local.vendor.count({ where: { orgId: org.id } }),
    items: await local.item.count({ where: { orgId: org.id } }),
    invoices: await local.salesDocument.count({ where: { orgId: org.id, type: 'INVOICE' } }),
    bills: await local.purchaseDocument.count({ where: { orgId: org.id, type: 'BILL' } }),
    journals: await local.journal.count({ where: { orgId: org.id } }),
  }
  console.log(JSON.stringify({ invoicesImported: invN, billsImported: billN, after }, null, 2))
  await local.$disconnect()
}
