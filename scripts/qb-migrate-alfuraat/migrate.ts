/**
 * Full QuickBooks Desktop → AL FURAAT MATERIALS migration.
 * Source: Desktop/qb-alfuraat-export (or C:/Users/Zmart/qb-export) XML from QBXMLRP2.
 *
 * Run: node scripts/qb-migrate-alfuraat/run.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

try {
  process.loadEnvFile('.env')
} catch {
  /* already set */
}

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '@prisma/client'

import { DEFAULT_FEATURE_FLAGS, parseFeatureFlags } from '@/lib/feature-flags'
import { permissionsFor } from '@/server/auth/permissions'
import type { OrgContext } from '@/server/auth/context'
import { wipeCompanyBooks } from '@/server/company-wipe'
import { seedChartOfAccounts } from '@/server/accounting/chart-of-accounts'
import { createDefaultSequences } from '@/server/sequences'
import * as contactService from '@/server/services/contact.service'
import * as itemService from '@/server/services/item.service'
import * as salesService from '@/server/services/sales.service'
import * as purchaseService from '@/server/services/purchase.service'
import * as journalService from '@/server/services/journal.service'
import * as paymentService from '@/server/services/payment.service'

const ORG_NAME = 'AL FURAAT MATERIALS'
const EXPORT_DIRS = [
  path.join(process.env.USERPROFILE ?? 'C:\\Users\\Zmart', 'Desktop', 'qb-alfuraat-export'),
  'C:\\Users\\Zmart\\qb-export',
]

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  transactionOptions: { maxWait: 20_000, timeout: 180_000 },
})

type Stats = Record<string, number>
const stats: Stats = {}
const errors: string[] = []

function bump(key: string, n = 1) {
  stats[key] = (stats[key] ?? 0) + n
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1]!.trim() : ''
}

function blocks(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(m[1]!)
  return out
}

function money(raw: string): string {
  const n = Number(String(raw).replace(/,/g, ''))
  if (!Number.isFinite(n)) return '0'
  return n.toFixed(4).replace(/\.?0+$/, (s) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s)) || '0'
}

function findExportDir(): string {
  for (const dir of EXPORT_DIRS) {
    if (fs.existsSync(path.join(dir, 'items.xml'))) return dir
  }
  throw new Error('Export folder not found (need items.xml)')
}

function readAll(dir: string, prefix: string): string {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f === `${prefix}.xml` || (f.startsWith(`${prefix}-part`) && f.endsWith('.xml')))
    .sort()
  return files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

function mapAccountType(qb: string): { type: Prisma.LedgerAccountCreateInput['type']; subtype: Prisma.LedgerAccountCreateInput['subtype'] } {
  switch (qb) {
    case 'Bank':
      return { type: 'ASSET', subtype: 'BANK' }
    case 'AccountsReceivable':
      return { type: 'ASSET', subtype: 'ACCOUNTS_RECEIVABLE' }
    case 'OtherCurrentAsset':
      return { type: 'ASSET', subtype: 'OTHER_CURRENT_ASSET' }
    case 'FixedAsset':
      return { type: 'ASSET', subtype: 'FIXED_ASSET' }
    case 'OtherAsset':
      return { type: 'ASSET', subtype: 'OTHER_CURRENT_ASSET' }
    case 'AccountsPayable':
      return { type: 'LIABILITY', subtype: 'ACCOUNTS_PAYABLE' }
    case 'CreditCard':
      return { type: 'LIABILITY', subtype: 'CREDIT_CARD' }
    case 'OtherCurrentLiability':
      return { type: 'LIABILITY', subtype: 'OTHER_CURRENT_LIABILITY' }
    case 'LongTermLiability':
      return { type: 'LIABILITY', subtype: 'LONG_TERM_LIABILITY' }
    case 'Equity':
      return { type: 'EQUITY', subtype: 'OWNERS_EQUITY' }
    case 'Income':
      return { type: 'REVENUE', subtype: 'INCOME' }
    case 'OtherIncome':
      return { type: 'REVENUE', subtype: 'OTHER_INCOME' }
    case 'CostOfGoodsSold':
      return { type: 'COGS', subtype: 'COST_OF_GOODS_SOLD' }
    case 'Expense':
      return { type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' }
    case 'OtherExpense':
      return { type: 'EXPENSE', subtype: 'OTHER_EXPENSE' }
    case 'NonPosting':
      return { type: 'EQUITY', subtype: 'OWNERS_EQUITY' }
    default:
      return { type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' }
  }
}

async function buildCtx(orgId: string): Promise<OrgContext> {
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })
  const membership = await prisma.membership.findFirst({
    where: { orgId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!membership) throw new Error('No OWNER/ADMIN membership on target org')

  const { logoStorageKey, featureFlags, ...orgFields } = organization
  const features = parseFeatureFlags(featureFlags)
  features.enableDocumentApprovals = false

  return {
    orgId,
    userId: membership.userId,
    role: membership.role,
    permissions: permissionsFor(membership.role),
    isSystemOwner: membership.user.isSystemOwner,
    canConnect: membership.canConnect,
    portalCustomerId: null,
    features: { ...DEFAULT_FEATURE_FLAGS, ...features, enableDocumentApprovals: false },
    organization: { ...orgFields, hasLogo: Boolean(logoStorageKey) },
    user: {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      image: membership.user.image,
    },
  }
}

async function ensureOfficeStore(orgId: string) {
  const existing = await prisma.store.findFirst({ where: { orgId, isOffice: true } })
  if (existing) return existing.id
  const inv = await prisma.ledgerAccount.findFirst({
    where: { orgId, OR: [{ systemKey: 'INVENTORY_ASSET' }, { name: { equals: 'Inventory Asset', mode: 'insensitive' } }] },
    select: { id: true },
  })
  if (!inv) throw new Error('Inventory Asset account missing after seed')
  const store = await prisma.store.create({
    data: { orgId, name: 'Office', isOffice: true, inventoryAccountId: inv.id },
  })
  return store.id
}

async function wipeAndSeed(orgId: string) {
  // wipeCompanyBooks removes memberships too — keep logins for this company.
  const memberships = await prisma.membership.findMany({ where: { orgId } })

  console.log('Wiping books…')
  await prisma.$transaction(
    async (tx) => {
      await wipeCompanyBooks(tx as never, orgId)
    },
    { timeout: 180_000 },
  )

  console.log('Reseeding chart + sequences + memberships…')
  const ownerUser =
    (await prisma.user.findFirst({
      where: { email: { equals: 'deeqa@gmail.com', mode: 'insensitive' } },
      select: { id: true },
    })) ??
    (await prisma.user.findFirst({
      where: { isSystemOwner: true },
      select: { id: true },
    }))
  if (!ownerUser) throw new Error('No deeqa@gmail.com or system owner to attach after wipe')

  await prisma.$transaction(async (tx) => {
    await createDefaultSequences(tx as never, orgId)
    await seedChartOfAccounts(tx as never, orgId)
    if (memberships.length > 0) {
      await tx.membership.createMany({
        data: memberships.map((m) => ({
          id: m.id,
          orgId: m.orgId,
          userId: m.userId,
          role: m.role,
          status: m.status,
          permissionsOverride: m.permissionsOverride,
          canConnect: m.canConnect,
          version: m.version,
          invitedById: m.invitedById,
          invitedAt: m.invitedAt,
          acceptedAt: m.acceptedAt,
        })),
        skipDuplicates: true,
      })
    } else {
      await tx.membership.create({
        data: {
          orgId,
          userId: ownerUser.id,
          role: 'OWNER',
          status: 'ACTIVE',
          acceptedAt: new Date(),
          canConnect: true,
        },
      })
    }
  })

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      featureFlags: {
        ...DEFAULT_FEATURE_FLAGS,
        enableDocumentApprovals: false,
      },
      allowNegativeStock: true,
    },
  })
}

async function importAccounts(dir: string, orgId: string) {
  const xml = readAll(dir, 'accounts')
  const existing = await prisma.ledgerAccount.findMany({ where: { orgId }, select: { id: true, name: true, code: true } })
  const byName = new Map(existing.map((a) => [a.name.toLowerCase(), a]))
  let codeN = 9000
  for (const block of blocks(xml, 'AccountRet')) {
    const name = tag(block, 'FullName') || tag(block, 'Name')
    if (!name || byName.has(name.toLowerCase())) continue
    const qbType = tag(block, 'AccountType')
    const mapped = mapAccountType(qbType)
    while (existing.some((a) => a.code === String(codeN)) || [...byName.values()].some((a) => a.code === String(codeN))) {
      codeN += 1
    }
    try {
      const created = await prisma.ledgerAccount.create({
        data: {
          orgId,
          code: String(codeN++),
          name,
          type: mapped.type,
          subtype: mapped.subtype,
          isActive: tag(block, 'IsActive') !== 'false',
          isSystem: false,
        },
      })
      byName.set(name.toLowerCase(), created)
      bump('accountsCreated')
    } catch (e) {
      errors.push(`account ${name}: ${e instanceof Error ? e.message : String(e)}`)
      bump('accountErrors')
    }
  }
  // Refresh map from DB so seeded + created names resolve.
  const all = await prisma.ledgerAccount.findMany({ where: { orgId }, select: { id: true, name: true, code: true } })
  return new Map(all.map((a) => [a.name.toLowerCase(), a]))
}

async function importContacts(dir: string, ctx: OrgContext) {
  const customersXml = readAll(dir, 'customers')
  const vendorsXml = readAll(dir, 'vendors')
  const customerMap = new Map<string, string>()
  const vendorMap = new Map<string, string>()

  for (const block of blocks(customersXml, 'CustomerRet')) {
    const name = tag(block, 'FullName') || tag(block, 'Name')
    if (!name) continue
    try {
      const created = await contactService.createCustomer(ctx, {
        displayName: name,
        companyName: tag(block, 'CompanyName') || null,
        email: null,
        phone: tag(block, 'Phone') || null,
        billingLine1: tag(block, 'Addr1') || null,
        priceLevel: 'RETAIL',
      } as never)
      customerMap.set(name.toLowerCase(), created.id)
      bump('customers')
    } catch (e) {
      errors.push(`customer ${name}: ${e instanceof Error ? e.message : String(e)}`)
      bump('customerErrors')
    }
  }

  for (const block of blocks(vendorsXml, 'VendorRet')) {
    const name = tag(block, 'FullName') || tag(block, 'Name')
    if (!name) continue
    try {
      const created = await contactService.createVendor(ctx, {
        displayName: name,
        companyName: tag(block, 'CompanyName') || null,
        email: null,
        phone: tag(block, 'Phone') || null,
        isActive: tag(block, 'IsActive') !== 'false',
      } as never)
      vendorMap.set(name.toLowerCase(), created.id)
      bump('vendors')
    } catch (e) {
      errors.push(`vendor ${name}: ${e instanceof Error ? e.message : String(e)}`)
      bump('vendorErrors')
    }
  }

  return { customerMap, vendorMap }
}

async function importItems(dir: string, ctx: OrgContext, storeId: string) {
  const xml = readAll(dir, 'items')
  const itemMap = new Map<string, string>()
  const kinds = [
    'ItemInventoryRet',
    'ItemNonInventoryRet',
    'ItemServiceRet',
    'ItemOtherChargeRet',
    'ItemDiscountRet',
  ] as const

  const income = await prisma.ledgerAccount.findFirst({
    where: { orgId: ctx.orgId, OR: [{ systemKey: 'UNCATEGORISED_INCOME' }, { name: 'Sales' }] },
    select: { id: true },
  })
  const expense = await prisma.ledgerAccount.findFirst({
    where: { orgId: ctx.orgId, OR: [{ systemKey: 'UNCATEGORISED_EXPENSE' }, { systemKey: 'COGS' }] },
    select: { id: true },
  })
  const inventory = await prisma.ledgerAccount.findFirst({
    where: { orgId: ctx.orgId, systemKey: 'INVENTORY_ASSET' },
    select: { id: true },
  })
  const cogs = await prisma.ledgerAccount.findFirst({
    where: { orgId: ctx.orgId, systemKey: 'COGS' },
    select: { id: true },
  })

  for (const kind of kinds) {
    for (const block of blocks(xml, kind)) {
      const name = tag(block, 'FullName') || tag(block, 'Name')
      if (!name || name.includes(':')) continue
      const type =
        kind === 'ItemInventoryRet'
          ? 'INVENTORY'
          : kind === 'ItemServiceRet'
            ? 'SERVICE'
            : kind === 'ItemDiscountRet'
              ? 'DISCOUNT'
              : 'NON_INVENTORY'
      const salesPrice = money(tag(block, 'SalesPrice') || '0')
      const purchaseCost = money(tag(block, 'PurchaseCost') || tag(block, 'AverageCost') || '0')
      const qty = Number(tag(block, 'QuantityOnHand') || '0')
      try {
        const created = await itemService.create(ctx, {
          type,
          name,
          salesDescription: tag(block, 'SalesDesc') || null,
          purchaseDescription: tag(block, 'PurchaseDesc') || null,
          salesPrice,
          purchaseCost,
          incomeAccountId: income?.id,
          expenseAccountId: type === 'INVENTORY' ? cogs?.id : expense?.id,
          inventoryAccountId: type === 'INVENTORY' ? inventory?.id : undefined,
          cogsAccountId: type === 'INVENTORY' ? cogs?.id : undefined,
          openingQuantity: type === 'INVENTORY' && qty > 0 ? String(qty) : undefined,
          openingUnitCost: type === 'INVENTORY' && qty > 0 ? purchaseCost : undefined,
          storeId: type === 'INVENTORY' && qty > 0 ? storeId : undefined,
          isActive: tag(block, 'IsActive') !== 'false',
        } as never)
        itemMap.set(name.toLowerCase(), created.id)
        bump('items')
      } catch (e) {
        errors.push(`item ${name}: ${e instanceof Error ? e.message : String(e)}`)
        bump('itemErrors')
      }
    }
  }
  return itemMap
}

async function ensureItem(
  ctx: OrgContext,
  itemMap: Map<string, string>,
  name: string,
  storeId: string,
): Promise<string | null> {
  const key = name.toLowerCase()
  const hit = itemMap.get(key)
  if (hit) return hit
  const income = await prisma.ledgerAccount.findFirst({
    where: { orgId: ctx.orgId, OR: [{ name: 'Sales' }, { systemKey: 'UNCATEGORISED_INCOME' }] },
    select: { id: true },
  })
  try {
    const created = await itemService.create(ctx, {
      type: 'NON_INVENTORY',
      name,
      salesPrice: '0',
      purchaseCost: '0',
      incomeAccountId: income?.id,
      isActive: true,
    } as never)
    itemMap.set(key, created.id)
    bump('itemsAuto')
    return created.id
  } catch (e) {
    errors.push(`auto-item ${name}: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}

async function importInvoices(
  dir: string,
  ctx: OrgContext,
  customerMap: Map<string, string>,
  itemMap: Map<string, string>,
  storeId: string,
) {
  const xml = readAll(dir, 'invoices')
  const invoiceIdByNumber = new Map<string, string>()
  for (const block of blocks(xml, 'InvoiceRet')) {
    const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
    const customerName = tag(block, 'FullName') // first FullName is usually customer in CustomerRef — fragile
    // Prefer CustomerRef block
    const custBlock = block.match(/<CustomerRef>[\s\S]*?<\/CustomerRef>/)?.[0] ?? ''
    const customer = tag(custBlock, 'FullName') || customerName
    const date = tag(block, 'TxnDate')
    if (!number || !customer || !date) {
      bump('invoiceSkipped')
      continue
    }
    let customerId = customerMap.get(customer.toLowerCase())
    if (!customerId) {
      try {
        const created = await contactService.createCustomer(ctx, {
          displayName: customer,
          isActive: true,
        } as never)
        customerId = created.id
        customerMap.set(customer.toLowerCase(), customerId)
        bump('customers')
      } catch (e) {
        errors.push(`invoice ${number} customer ${customer}: ${e instanceof Error ? e.message : String(e)}`)
        bump('invoiceErrors')
        continue
      }
    }

    const lines: { itemId: string; quantity: string; unitPrice: string; description?: string | null }[] = []
    for (const line of blocks(block, 'InvoiceLineRet')) {
      const itemBlock = line.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? ''
      const itemName = tag(itemBlock, 'FullName')
      if (!itemName) continue
      const itemId = await ensureItem(ctx, itemMap, itemName, storeId)
      if (!itemId) continue
      const qty = money(tag(line, 'Quantity') || '1')
      const rate = money(tag(line, 'Rate') || '0')
      if (Number(qty) <= 0) continue
      lines.push({
        itemId,
        quantity: qty,
        unitPrice: rate,
        description: tag(line, 'Desc') || null,
      })
    }
    if (lines.length === 0) {
      bump('invoiceNoLines')
      continue
    }
    try {
      const doc = await salesService.create(ctx, 'INVOICE', {
        number,
        customerId,
        date,
        reference: tag(block, 'PONumber') || undefined,
        memo: tag(block, 'Memo') || undefined,
        saveAsDraft: false,
        discountKind: 'percent',
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          description: l.description ?? undefined,
          storeId,
        })),
      } as never)
      invoiceIdByNumber.set(number, doc.id)
      bump('invoices')
    } catch (e) {
      errors.push(`invoice ${number}: ${e instanceof Error ? e.message : String(e)}`)
      bump('invoiceErrors')
    }
  }
  return invoiceIdByNumber
}

async function importBills(
  dir: string,
  ctx: OrgContext,
  vendorMap: Map<string, string>,
  itemMap: Map<string, string>,
  storeId: string,
) {
  const xml = readAll(dir, 'bills')
  for (const block of blocks(xml, 'BillRet')) {
    const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
    const vendorBlock = block.match(/<VendorRef>[\s\S]*?<\/VendorRef>/)?.[0] ?? ''
    const vendor = tag(vendorBlock, 'FullName')
    const date = tag(block, 'TxnDate')
    if (!number || !vendor || !date) {
      bump('billSkipped')
      continue
    }
    let vendorId = vendorMap.get(vendor.toLowerCase())
    if (!vendorId) {
      try {
        const created = await contactService.createVendor(ctx, { displayName: vendor, isActive: true } as never)
        vendorId = created.id
        vendorMap.set(vendor.toLowerCase(), vendorId)
        bump('vendors')
      } catch (e) {
        errors.push(`bill ${number} vendor ${vendor}: ${e instanceof Error ? e.message : String(e)}`)
        bump('billErrors')
        continue
      }
    }

    const lines: { itemId?: string; expenseAccountId?: string; quantity: string; unitPrice: string; description?: string }[] =
      []
    for (const line of blocks(block, 'ItemLineRet')) {
      const itemBlock = line.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? ''
      const itemName = tag(itemBlock, 'FullName')
      if (!itemName) continue
      const itemId = await ensureItem(ctx, itemMap, itemName, storeId)
      if (!itemId) continue
      const qty = money(tag(line, 'Quantity') || '1')
      const cost = money(tag(line, 'Cost') || tag(line, 'Amount') || '0')
      if (Number(qty) <= 0) continue
      lines.push({ itemId, quantity: qty, unitPrice: cost, description: tag(line, 'Desc') || undefined })
    }
    for (const line of blocks(block, 'ExpenseLineRet')) {
      const acctBlock = line.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? ''
      const acctName = tag(acctBlock, 'FullName')
      const amount = money(tag(line, 'Amount') || '0')
      if (!acctName || Number(amount) <= 0) continue
      let account = await prisma.ledgerAccount.findFirst({
        where: { orgId: ctx.orgId, name: { equals: acctName, mode: 'insensitive' } },
        select: { id: true },
      })
      if (!account) {
        account = await prisma.ledgerAccount.findFirst({
          where: { orgId: ctx.orgId, systemKey: 'UNCATEGORISED_EXPENSE' },
          select: { id: true },
        })
      }
      if (!account) continue
      lines.push({
        expenseAccountId: account.id,
        quantity: '1',
        unitPrice: amount,
        description: tag(line, 'Memo') || acctName,
      })
    }
    if (lines.length === 0) {
      bump('billNoLines')
      continue
    }
    try {
      await purchaseService.create(ctx, 'BILL', {
        number,
        vendorId,
        date,
        memo: tag(block, 'Memo') || undefined,
        saveAsDraft: false,
        acknowledgeDuplicate: true,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          expenseAccountId: l.expenseAccountId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          description: l.description,
          storeId,
        })),
      } as never)
      bump('bills')
    } catch (e) {
      errors.push(`bill ${number}: ${e instanceof Error ? e.message : String(e)}`)
      bump('billErrors')
    }
  }
}

async function importJournals(dir: string, ctx: OrgContext, accountByName: Map<string, { id: string }>) {
  const xml = readAll(dir, 'journals')
  for (const block of blocks(xml, 'JournalEntryRet')) {
    const number = tag(block, 'RefNumber') || undefined
    const date = tag(block, 'TxnDate')
    if (!date) {
      bump('journalSkipped')
      continue
    }
    const lines: { accountId: string; debit: string; credit: string; description: string }[] = []
    for (const line of [...blocks(block, 'JournalDebitLine'), ...blocks(block, 'JournalCreditLine')]) {
      const acctBlock = line.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? ''
      const acctName = tag(acctBlock, 'FullName')
      if (!acctName) continue
      let account = accountByName.get(acctName.toLowerCase())
      if (!account) {
        const row = await prisma.ledgerAccount.findFirst({
          where: { orgId: ctx.orgId, name: { equals: acctName, mode: 'insensitive' } },
          select: { id: true },
        })
        if (!row) {
          bump('journalLineSkipAccount')
          continue
        }
        account = row
        accountByName.set(acctName.toLowerCase(), row)
      }
      const amount = money(tag(line, 'Amount') || '0')
      const isDebit = line.includes('JournalDebitLine') || Boolean(block.match(new RegExp(`<JournalDebitLine>[\\s\\S]*?<AccountRef>[\\s\\S]*?${acctName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)))
      // Simpler: detect from parent tag by checking which array we iterate — already split
      const debit = blocks(block, 'JournalDebitLine').includes(line) ? amount : ''
      const credit = blocks(block, 'JournalCreditLine').includes(line) ? amount : ''
      // Fix: when iterating separately, set properly
      void isDebit
      lines.push({
        accountId: account.id,
        debit: '',
        credit: '',
        description: tag(line, 'Memo') || '',
      })
      // overwrite last based on which collection — redo loop cleanly below
      lines.pop()
    }

    const built: { accountId: string; debit: string; credit: string; description: string }[] = []
    for (const line of blocks(block, 'JournalDebitLine')) {
      const acctName = tag(line.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? '', 'FullName')
      if (!acctName) continue
      let account = accountByName.get(acctName.toLowerCase())
      if (!account) {
        const row = await prisma.ledgerAccount.findFirst({
          where: { orgId: ctx.orgId, name: { equals: acctName, mode: 'insensitive' } },
          select: { id: true },
        })
        if (!row) continue
        account = row
        accountByName.set(acctName.toLowerCase(), row)
      }
      built.push({
        accountId: account.id,
        debit: money(tag(line, 'Amount') || '0'),
        credit: '',
        description: tag(line, 'Memo') || '',
      })
    }
    for (const line of blocks(block, 'JournalCreditLine')) {
      const acctName = tag(line.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? '', 'FullName')
      if (!acctName) continue
      let account = accountByName.get(acctName.toLowerCase())
      if (!account) {
        const row = await prisma.ledgerAccount.findFirst({
          where: { orgId: ctx.orgId, name: { equals: acctName, mode: 'insensitive' } },
          select: { id: true },
        })
        if (!row) continue
        account = row
        accountByName.set(acctName.toLowerCase(), row)
      }
      built.push({
        accountId: account.id,
        debit: '',
        credit: money(tag(line, 'Amount') || '0'),
        description: tag(line, 'Memo') || '',
      })
    }
    if (built.length < 2) {
      bump('journalSkipped')
      continue
    }
    try {
      await journalService.createManual(ctx, {
        number,
        date,
        memo: tag(block, 'Memo') || undefined,
        isAdjusting: false,
        autoReverse: false,
        lines: built,
      } as never)
      bump('journals')
    } catch (e) {
      errors.push(`journal ${number ?? date}: ${e instanceof Error ? e.message : String(e)}`)
      bump('journalErrors')
    }
  }
}

async function importPayments(
  dir: string,
  ctx: OrgContext,
  customerMap: Map<string, string>,
  invoiceIdByNumber: Map<string, string>,
) {
  const xml = readAll(dir, 'payments')
  const deposit =
    (await prisma.ledgerAccount.findFirst({
      where: { orgId: ctx.orgId, OR: [{ systemKey: 'UNDEPOSITED_FUNDS' }, { subtype: 'BANK' }] },
      select: { id: true },
      orderBy: { code: 'asc' },
    })) ?? null
  if (!deposit) {
    errors.push('No deposit account for payments')
    return
  }

  for (const block of blocks(xml, 'ReceivePaymentRet')) {
    const customerBlock = block.match(/<CustomerRef>[\s\S]*?<\/CustomerRef>/)?.[0] ?? ''
    const customer = tag(customerBlock, 'FullName')
    const date = tag(block, 'TxnDate')
    const amount = money(tag(block, 'TotalAmount') || '0')
    if (!customer || !date || Number(amount) <= 0) {
      bump('paymentSkipped')
      continue
    }
    const customerId = customerMap.get(customer.toLowerCase())
    if (!customerId) {
      bump('paymentSkipped')
      continue
    }
    const applications: { invoiceId: string; amount: string }[] = []
    for (const line of blocks(block, 'AppliedToTxnRet')) {
      const txnType = tag(line, 'TxnType')
      const ref = tag(line, 'RefNumber')
      const applied = money(tag(line, 'Amount') || '0')
      if (txnType !== 'Invoice' || !ref || Number(applied) <= 0) continue
      const invoiceId = invoiceIdByNumber.get(ref)
      if (!invoiceId) continue
      applications.push({ invoiceId, amount: applied })
    }
    try {
      await paymentService.create(ctx, {
        customerId,
        date,
        amount,
        method: 'OTHER',
        depositAccountId: deposit.id,
        reference: tag(block, 'RefNumber') || undefined,
        memo: tag(block, 'Memo') || undefined,
        acknowledgeDuplicate: true,
        applications,
      } as never)
      bump('payments')
    } catch (e) {
      errors.push(`payment ${customer} ${date}: ${e instanceof Error ? e.message : String(e)}`)
      bump('paymentErrors')
    }
  }
}

export async function main() {
  const dir = findExportDir()
  console.log('Export dir:', dir)

  const org = await prisma.organization.findFirst({
    where: { name: { equals: ORG_NAME, mode: 'insensitive' } },
  })
  if (!org) throw new Error(`Organisation "${ORG_NAME}" not found`)
  console.log('Target org:', org.name, org.id)

  // Backup snapshot counts
  const before = {
    customers: await prisma.customer.count({ where: { orgId: org.id } }),
    items: await prisma.item.count({ where: { orgId: org.id } }),
    invoices: await prisma.salesDocument.count({ where: { orgId: org.id, type: 'INVOICE' } }),
  }
  fs.writeFileSync(
    path.join(dir, 'pre-migrate-counts.json'),
    JSON.stringify({ at: new Date().toISOString(), before, orgId: org.id }, null, 2),
  )

  await wipeAndSeed(org.id)
  const ctx = await buildCtx(org.id)
  const storeId = await ensureOfficeStore(org.id)

  console.log('Importing accounts…')
  const accountByName = await importAccounts(dir, org.id)

  console.log('Importing customers/vendors…')
  const { customerMap, vendorMap } = await importContacts(dir, ctx)

  console.log('Importing items…')
  const itemMap = await importItems(dir, ctx, storeId)

  console.log('Importing invoices…')
  const invoiceIdByNumber = await importInvoices(dir, ctx, customerMap, itemMap, storeId)

  console.log('Importing bills…')
  await importBills(dir, ctx, vendorMap, itemMap, storeId)

  console.log('Importing journals…')
  await importJournals(dir, ctx, accountByName)

  console.log('Importing payments…')
  await importPayments(dir, ctx, customerMap, invoiceIdByNumber)

  const after = {
    customers: await prisma.customer.count({ where: { orgId: org.id } }),
    vendors: await prisma.vendor.count({ where: { orgId: org.id } }),
    items: await prisma.item.count({ where: { orgId: org.id } }),
    invoices: await prisma.salesDocument.count({ where: { orgId: org.id, type: 'INVOICE' } }),
    bills: await prisma.purchaseDocument.count({ where: { orgId: org.id, type: 'BILL' } }),
    journals: await prisma.journal.count({ where: { orgId: org.id } }),
    payments: await prisma.customerPayment.count({ where: { orgId: org.id } }),
  }

  const sample = await prisma.salesDocument.findFirst({
    where: { orgId: org.id, type: 'INVOICE' },
    include: { lines: { include: { item: { select: { name: true } } } } },
    orderBy: { number: 'asc' },
  })

  const report = { stats, after, sampleInvoice: sample, errorCount: errors.length, errors: errors.slice(0, 80) }
  fs.writeFileSync(path.join(dir, 'migrate-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ stats, after, errorCount: errors.length, sampleNumber: sample?.number }, null, 2))
  if (errors[0]) console.log('First errors:', errors.slice(0, 10))
  await prisma.$disconnect()
}

const isDirect =
  process.argv[1]?.includes('migrate.ts') || process.argv[1]?.includes('run.mjs')

if (isDirect) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
