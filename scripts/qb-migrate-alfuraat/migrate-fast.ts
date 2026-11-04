/**
 * Fast path: bulk lists via Prisma, concurrent document create via services.
 * Run: pnpm exec vitest run scripts/qb-migrate-alfuraat/migrate-fast.test.ts
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
import { permissionsFor } from '@/server/auth/permissions'
import type { OrgContext } from '@/server/auth/context'
import { wipeCompanyBooks } from '@/server/company-wipe'
import { seedChartOfAccounts } from '@/server/accounting/chart-of-accounts'
import { createDefaultSequences } from '@/server/sequences'
import * as salesService from '@/server/services/sales.service'
import * as purchaseService from '@/server/services/purchase.service'
import * as journalService from '@/server/services/journal.service'
import * as paymentService from '@/server/services/payment.service'

const ORG_ID = 'cmvezuwzw000507l8ewxbhc15'
const ORG_NAME = 'AL FURAAT MATERIALS'
const CONCURRENCY = 8
const EXPORT_DIRS = [
  path.join(process.env.USERPROFILE ?? 'C:\\Users\\Zmart', 'Desktop', 'qb-alfuraat-export'),
  'C:\\Users\\Zmart\\qb-export',
]

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! }),
  transactionOptions: { maxWait: 30_000, timeout: 180_000 },
})

const stats: Record<string, number> = {}
const errors: string[] = []
function bump(k: string, n = 1) {
  stats[k] = (stats[k] ?? 0) + n
}

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
  const s = n.toFixed(4)
  return s.replace(/\.?0+$/, '') || '0'
}
function id() {
  return `c${randomBytes(12).toString('hex')}`
}
function findDir() {
  for (const d of EXPORT_DIRS) if (fs.existsSync(path.join(d, 'items.xml'))) return d
  throw new Error('export dir missing')
}
function readAll(dir: string, prefix: string) {
  return fs
    .readdirSync(dir)
    .filter((f) => f === `${prefix}.xml` || (f.startsWith(`${prefix}-part`) && f.endsWith('.xml')))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')
}

async function mapPool<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>) {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx]!, idx)
    }
  })
  await Promise.all(workers)
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

  const ownerUser =
    (await prisma.user.findFirst({ where: { email: { equals: 'deeqa@gmail.com', mode: 'insensitive' } } })) ??
    (await prisma.user.findFirst({ where: { isSystemOwner: true } }))
  if (!ownerUser) throw new Error('no owner user')

  const memberships = await prisma.membership.findMany({ where: { orgId: org.id } })

  console.log('Wipe…')
  await prisma.$transaction(async (tx) => wipeCompanyBooks(tx as never, org.id), { timeout: 180_000 })

  console.log('Seed…')
  await prisma.$transaction(async (tx) => {
    await createDefaultSequences(tx as never, org.id)
    await seedChartOfAccounts(tx as never, org.id)
    if (memberships.length) {
      await tx.membership.createMany({
        data: memberships.map((m) => ({
          id: m.id,
          orgId: m.orgId,
          userId: m.userId,
          role: m.role,
          status: m.status,
          permissionsOverride: m.permissionsOverride,
          canConnect: m.canConnect,
          version: 1,
          invitedById: m.invitedById,
          invitedAt: m.invitedAt,
          acceptedAt: m.acceptedAt,
        })),
        skipDuplicates: true,
      })
    } else {
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
    }
  })

  await prisma.organization.update({
    where: { id: org.id },
    data: { allowNegativeStock: true, featureFlags: { ...DEFAULT_FEATURE_FLAGS, enableDocumentApprovals: false } },
  })

  const income = await prisma.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, OR: [{ name: 'Sales' }, { systemKey: 'UNCATEGORISED_INCOME' }] },
  })
  const expense = await prisma.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, OR: [{ systemKey: 'UNCATEGORISED_EXPENSE' }, { systemKey: 'COGS' }] },
  })
  const inventory = await prisma.ledgerAccount.findFirstOrThrow({
    where: { orgId: org.id, systemKey: 'INVENTORY_ASSET' },
  })
  const cogs = await prisma.ledgerAccount.findFirstOrThrow({ where: { orgId: org.id, systemKey: 'COGS' } })
  const undeposited = await prisma.ledgerAccount.findFirst({
    where: { orgId: org.id, systemKey: 'UNDEPOSITED_FUNDS' },
  })
  const bank = await prisma.ledgerAccount.findFirst({
    where: { orgId: org.id, subtype: 'BANK' },
    orderBy: { code: 'asc' },
  })
  const depositId = undeposited?.id ?? bank?.id
  if (!depositId) throw new Error('no deposit account')

  const store = await prisma.store.create({
    data: { orgId: org.id, name: 'Office', isOffice: true, inventoryAccountId: inventory.id },
  })

  // --- Customers / vendors (bulk) ---
  console.log('Customers/vendors…')
  const customerMap = new Map<string, string>()
  const vendorMap = new Map<string, string>()
  const custRows = blocks(readAll(dir, 'customers'), 'CustomerRet').map((b) => {
    const name = tag(b, 'FullName') || tag(b, 'Name')
    const rowId = id()
    if (name) customerMap.set(name.toLowerCase(), rowId)
    return name
      ? {
          id: rowId,
          orgId: org.id,
          displayName: name,
          companyName: tag(b, 'CompanyName') || null,
          phone: tag(b, 'Phone') || null,
          billingLine1: tag(tag(b, 'BillAddress') || b, 'Addr1') || null,
          priceLevel: 'RETAIL' as const,
          isActive: tag(b, 'IsActive') !== 'false',
        }
      : null
  }).filter(Boolean) as { id: string; orgId: string; displayName: string; companyName: string | null; phone: string | null; billingLine1: string | null; priceLevel: 'RETAIL'; isActive: boolean }[]

  if (custRows.length) {
    await prisma.customer.createMany({ data: custRows, skipDuplicates: true })
    bump('customers', custRows.length)
  }

  const vendRows = blocks(readAll(dir, 'vendors'), 'VendorRet').map((b) => {
    const name = tag(b, 'FullName') || tag(b, 'Name')
    const rowId = id()
    if (name) vendorMap.set(name.toLowerCase(), rowId)
    return name
      ? {
          id: rowId,
          orgId: org.id,
          displayName: name,
          companyName: tag(b, 'CompanyName') || null,
          phone: tag(b, 'Phone') || null,
          isActive: tag(b, 'IsActive') !== 'false',
        }
      : null
  }).filter(Boolean) as { id: string; orgId: string; displayName: string; companyName: string | null; phone: string | null; isActive: boolean }[]
  if (vendRows.length) {
    await prisma.vendor.createMany({ data: vendRows, skipDuplicates: true })
    bump('vendors', vendRows.length)
  }

  // --- Items (bulk, no opening stock — history comes from invoices/bills) ---
  console.log('Items…')
  const itemMap = new Map<string, string>()
  const itemXml = readAll(dir, 'items')
  const itemData: {
    id: string
    orgId: string
    name: string
    type: 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE' | 'OTHER_CHARGE' | 'DISCOUNT'
    salesDescription: string | null
    purchaseDescription: string | null
    salesPrice: string
    purchaseCost: string
    incomeAccountId: string
    expenseAccountId: string | null
    inventoryAccountId: string | null
    cogsAccountId: string | null
    isActive: boolean
    isTaxable: boolean
    availableInPos: boolean
  }[] = []

  const pushItem = (kind: string, block: string) => {
    const name = tag(block, 'FullName') || tag(block, 'Name')
    if (!name || name.includes(':') || itemMap.has(name.toLowerCase())) return
    const type =
      kind === 'ItemInventoryRet'
        ? 'INVENTORY'
        : kind === 'ItemServiceRet'
          ? 'SERVICE'
          : kind === 'ItemDiscountRet'
            ? 'DISCOUNT'
            : kind === 'ItemOtherChargeRet'
              ? 'OTHER_CHARGE'
              : 'NON_INVENTORY'
    const rowId = id()
    itemMap.set(name.toLowerCase(), rowId)
    itemData.push({
      id: rowId,
      orgId: org.id,
      name,
      type,
      salesDescription: tag(block, 'SalesDesc') || null,
      purchaseDescription: tag(block, 'PurchaseDesc') || null,
      salesPrice: money(tag(block, 'SalesPrice') || '0'),
      purchaseCost: money(tag(block, 'PurchaseCost') || tag(block, 'AverageCost') || '0'),
      incomeAccountId: income.id,
      expenseAccountId: type === 'INVENTORY' ? cogs.id : expense.id,
      inventoryAccountId: type === 'INVENTORY' ? inventory.id : null,
      cogsAccountId: type === 'INVENTORY' ? cogs.id : null,
      isActive: tag(block, 'IsActive') !== 'false',
      isTaxable: false,
      availableInPos: true,
    })
  }
  for (const kind of [
    'ItemInventoryRet',
    'ItemNonInventoryRet',
    'ItemServiceRet',
    'ItemOtherChargeRet',
    'ItemDiscountRet',
  ]) {
    for (const b of blocks(itemXml, kind)) pushItem(kind, b)
  }
  // chunk createMany
  for (let i = 0; i < itemData.length; i += 200) {
    await prisma.item.createMany({ data: itemData.slice(i, i + 200), skipDuplicates: true })
  }
  bump('items', itemData.length)
  console.log(`Items created: ${itemData.length}`)

  const ctx = await buildCtx(org.id)

  async function ensureCustomer(name: string) {
    const key = name.toLowerCase()
    let hit = customerMap.get(key)
    if (hit) return hit
    hit = id()
    await prisma.customer.create({
      data: { id: hit, orgId: org.id, displayName: name, priceLevel: 'RETAIL', isActive: true },
    })
    customerMap.set(key, hit)
    bump('customersAuto')
    return hit
  }
  async function ensureVendor(name: string) {
    const key = name.toLowerCase()
    let hit = vendorMap.get(key)
    if (hit) return hit
    hit = id()
    await prisma.vendor.create({
      data: { id: hit, orgId: org.id, displayName: name, isActive: true },
    })
    vendorMap.set(key, hit)
    bump('vendorsAuto')
    return hit
  }
  async function ensureItem(name: string) {
    const key = name.toLowerCase()
    let hit = itemMap.get(key)
    if (hit) return hit
    hit = id()
    await prisma.item.create({
      data: {
        id: hit,
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
    itemMap.set(key, hit)
    bump('itemsAuto')
    return hit
  }

  // --- Invoices concurrent ---
  console.log('Invoices…')
  const invoiceBlocks = blocks(readAll(dir, 'invoices'), 'InvoiceRet')
  const invoiceIdByNumber = new Map<string, string>()
  await mapPool(invoiceBlocks, CONCURRENCY, async (block) => {
    const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
    const customer = tag(block.match(/<CustomerRef>[\s\S]*?<\/CustomerRef>/)?.[0] ?? '', 'FullName')
    const date = tag(block, 'TxnDate')
    if (!number || !customer || !date) {
      bump('invoiceSkipped')
      return
    }
    try {
      const customerId = await ensureCustomer(customer)
      const lines = []
      for (const line of blocks(block, 'InvoiceLineRet')) {
        const itemName = tag(line.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName')
        if (!itemName) continue
        const qty = money(tag(line, 'Quantity') || '1')
        if (Number(qty) <= 0) continue
        const itemId = await ensureItem(itemName)
        lines.push({
          itemId,
          quantity: qty,
          unitPrice: money(tag(line, 'Rate') || '0'),
          description: tag(line, 'Desc') || undefined,
          storeId: store.id,
        })
      }
      if (!lines.length) {
        bump('invoiceNoLines')
        return
      }
      const doc = await salesService.create(ctx, 'INVOICE', {
        number,
        customerId,
        date,
        reference: tag(block, 'PONumber') || undefined,
        memo: tag(block, 'Memo') || undefined,
        saveAsDraft: false,
        discountKind: 'percent',
        lines,
      } as never)
      invoiceIdByNumber.set(number, doc.id)
      bump('invoices')
      if ((stats.invoices ?? 0) % 25 === 0) console.log(`  invoices ${stats.invoices}`)
    } catch (e) {
      bump('invoiceErrors')
      errors.push(`inv ${number}: ${e instanceof Error ? e.message : String(e)}`)
    }
  })

  // --- Bills concurrent ---
  console.log('Bills…')
  const billBlocks = blocks(readAll(dir, 'bills'), 'BillRet')
  await mapPool(billBlocks, CONCURRENCY, async (block) => {
    const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
    const vendor = tag(block.match(/<VendorRef>[\s\S]*?<\/VendorRef>/)?.[0] ?? '', 'FullName')
    const date = tag(block, 'TxnDate')
    if (!number || !vendor || !date) {
      bump('billSkipped')
      return
    }
    try {
      const vendorId = await ensureVendor(vendor)
      const lines: {
        itemId?: string
        expenseAccountId?: string
        quantity: string
        unitPrice: string
        description?: string
        storeId: string
      }[] = []
      for (const line of blocks(block, 'ItemLineRet')) {
        const itemName = tag(line.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName')
        if (!itemName) continue
        const qty = money(tag(line, 'Quantity') || '1')
        if (Number(qty) <= 0) continue
        lines.push({
          itemId: await ensureItem(itemName),
          quantity: qty,
          unitPrice: money(tag(line, 'Cost') || '0'),
          description: tag(line, 'Desc') || undefined,
          storeId: store.id,
        })
      }
      for (const line of blocks(block, 'ExpenseLineRet')) {
        const acctName = tag(line.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? '', 'FullName')
        const amount = money(tag(line, 'Amount') || '0')
        if (!acctName || Number(amount) <= 0) continue
        const account =
          (await prisma.ledgerAccount.findFirst({
            where: { orgId: org.id, name: { equals: acctName, mode: 'insensitive' } },
          })) ?? expense
        lines.push({
          expenseAccountId: account.id,
          quantity: '1',
          unitPrice: amount,
          description: tag(line, 'Memo') || acctName,
          storeId: store.id,
        })
      }
      if (!lines.length) {
        bump('billNoLines')
        return
      }
      await purchaseService.create(ctx, 'BILL', {
        number,
        vendorId,
        date,
        memo: tag(block, 'Memo') || undefined,
        saveAsDraft: false,
        acknowledgeDuplicate: true,
        lines,
      } as never)
      bump('bills')
      if ((stats.bills ?? 0) % 25 === 0) console.log(`  bills ${stats.bills}`)
    } catch (e) {
      bump('billErrors')
      errors.push(`bill ${number}: ${e instanceof Error ? e.message : String(e)}`)
    }
  })

  // --- Journals ---
  console.log('Journals…')
  const accountCache = new Map(
    (await prisma.ledgerAccount.findMany({ where: { orgId: org.id }, select: { id: true, name: true } })).map((a) => [
      a.name.toLowerCase(),
      a.id,
    ]),
  )
  const journalBlocks = blocks(readAll(dir, 'journals'), 'JournalEntryRet')
  await mapPool(journalBlocks, 4, async (block) => {
    const date = tag(block, 'TxnDate')
    if (!date) return
    const lines: { accountId: string; debit: string; credit: string; description: string }[] = []
    for (const line of blocks(block, 'JournalDebitLine')) {
      const name = tag(line.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? '', 'FullName')
      const accountId = name ? accountCache.get(name.toLowerCase()) : undefined
      if (!accountId) continue
      lines.push({ accountId, debit: money(tag(line, 'Amount') || '0'), credit: '', description: tag(line, 'Memo') || '' })
    }
    for (const line of blocks(block, 'JournalCreditLine')) {
      const name = tag(line.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? '', 'FullName')
      const accountId = name ? accountCache.get(name.toLowerCase()) : undefined
      if (!accountId) continue
      lines.push({ accountId, debit: '', credit: money(tag(line, 'Amount') || '0'), description: tag(line, 'Memo') || '' })
    }
    if (lines.length < 2) {
      bump('journalSkipped')
      return
    }
    try {
      await journalService.createManual(ctx, {
        number: tag(block, 'RefNumber') || undefined,
        date,
        memo: tag(block, 'Memo') || undefined,
        isAdjusting: false,
        autoReverse: false,
        lines,
      } as never)
      bump('journals')
    } catch (e) {
      bump('journalErrors')
      errors.push(`je ${date}: ${e instanceof Error ? e.message : String(e)}`)
    }
  })

  // --- Payments ---
  console.log('Payments…')
  for (const block of blocks(readAll(dir, 'payments'), 'ReceivePaymentRet')) {
    const customer = tag(block.match(/<CustomerRef>[\s\S]*?<\/CustomerRef>/)?.[0] ?? '', 'FullName')
    const date = tag(block, 'TxnDate')
    const amount = money(tag(block, 'TotalAmount') || '0')
    const customerId = customer ? customerMap.get(customer.toLowerCase()) : undefined
    if (!customerId || !date || Number(amount) <= 0) {
      bump('paymentSkipped')
      continue
    }
    const applications = []
    for (const line of blocks(block, 'AppliedToTxnRet')) {
      if (tag(line, 'TxnType') !== 'Invoice') continue
      const ref = tag(line, 'RefNumber')
      const invoiceId = ref ? invoiceIdByNumber.get(ref) : undefined
      const applied = money(tag(line, 'Amount') || '0')
      if (!invoiceId || Number(applied) <= 0) continue
      applications.push({ invoiceId, amount: applied })
    }
    try {
      await paymentService.create(ctx, {
        customerId,
        date,
        amount,
        method: 'OTHER',
        depositAccountId: depositId,
        reference: tag(block, 'RefNumber') || undefined,
        acknowledgeDuplicate: true,
        applications,
      } as never)
      bump('payments')
    } catch (e) {
      bump('paymentErrors')
      errors.push(`pmt ${customer}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

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
    include: { lines: { include: { item: { select: { name: true } } }, take: 8 } },
    orderBy: { number: 'asc' },
  })
  const report = { stats, after, sample, errorCount: errors.length, errors: errors.slice(0, 100) }
  fs.writeFileSync(path.join(dir, 'migrate-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ stats, after, errorCount: errors.length, sample: sample?.number }, null, 2))
  await prisma.$disconnect()
}
