/**
 * Write company backup JSON files into the user's Downloads folder.
 */
process.loadEnvFile('.env')
const { writeFileSync, mkdirSync } = await import('node:fs')
const { join } = await import('node:path')
const { homedir } = await import('node:os')
const { PrismaPg } = await import('@prisma/adapter-pg')
const { PrismaClient } = await import('@prisma/client')

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company'
}

function json(value) {
  return JSON.stringify(
    value,
    (_key, item) => {
      if (item instanceof Date) return item.toISOString()
      if (typeof item === 'bigint') return item.toString()
      if (item && typeof item === 'object' && item.constructor?.name === 'Decimal') {
        return item.toString()
      }
      return item
    },
    2,
  )
}

async function companyBackup(orgId) {
  const where = { orgId }
  const [
    organization,
    memberships,
    sequences,
    accounts,
    fiscalYears,
    periods,
    journals,
    journalLines,
    paymentTerms,
    customers,
    customerFiles,
    vendors,
    itemCategories,
    items,
    taxAgencies,
    taxRates,
    taxCodes,
    taxCodeRates,
    salesDocuments,
    salesDocumentLines,
    customerPayments,
    salesApplications,
    purchaseDocuments,
    purchaseDocumentLines,
    billPayments,
    purchaseApplications,
    bankTransfers,
    deposits,
    depositLines,
    importedTransactions,
    reconciliations,
    reconciliationEntries,
    inventoryTransactions,
    inventoryAdjustments,
    inventoryAdjustmentLines,
    bookmarks,
    bankRules,
    reportNotes,
    ledgerFiles,
    auditLogs,
    stores,
    posRegisters,
    posPaymentMethods,
  ] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId } }),
    db.membership.findMany({
      where,
      select: {
        id: true,
        role: true,
        status: true,
        invitedAt: true,
        acceptedAt: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.documentSequence.findMany({ where }),
    db.ledgerAccount.findMany({ where, orderBy: { code: 'asc' } }),
    db.fiscalYear.findMany({ where }),
    db.accountingPeriod.findMany({ where }),
    db.journal.findMany({ where }),
    db.journalLine.findMany({ where }),
    db.paymentTerm.findMany({ where }),
    db.customer.findMany({ where }),
    db.customerFile.findMany({ where }),
    db.vendor.findMany({ where }),
    db.itemCategory.findMany({ where }),
    db.item.findMany({ where }),
    db.taxAgency.findMany({ where }),
    db.taxRate.findMany({ where }),
    db.taxCode.findMany({ where }),
    db.taxCodeRate.findMany({ where }),
    db.salesDocument.findMany({ where }),
    db.salesDocumentLine.findMany({ where }),
    db.customerPayment.findMany({ where }),
    db.salesApplication.findMany({ where }),
    db.purchaseDocument.findMany({ where }),
    db.purchaseDocumentLine.findMany({ where }),
    db.billPayment.findMany({ where }),
    db.purchaseApplication.findMany({ where }),
    db.bankTransfer.findMany({ where }),
    db.deposit.findMany({ where }),
    db.depositLine.findMany({ where }),
    db.importedTransaction.findMany({ where }),
    db.bankReconciliation.findMany({ where }),
    db.reconciliationEntry.findMany({ where }),
    db.inventoryTransaction.findMany({ where }),
    db.inventoryAdjustment.findMany({ where }),
    db.inventoryAdjustmentLine.findMany({ where }),
    db.workspaceBookmark.findMany({ where }),
    db.bankRule.findMany({ where }),
    db.reportNote.findMany({ where }),
    db.ledgerFile.findMany({ where }),
    db.auditLog.findMany({ where }),
    db.store.findMany({ where }),
    db.posRegister.findMany({ where }),
    db.posPaymentMethod.findMany({ where }),
  ])

  return {
    version: 1,
    takenAt: new Date().toISOString(),
    organization,
    memberships,
    sequences,
    accounts,
    fiscalYears,
    periods,
    journals,
    journalLines,
    paymentTerms,
    customers,
    customerFiles,
    vendors,
    itemCategories,
    items,
    taxAgencies,
    taxRates,
    taxCodes,
    taxCodeRates,
    salesDocuments,
    salesDocumentLines,
    customerPayments,
    salesApplications,
    purchaseDocuments,
    purchaseDocumentLines,
    billPayments,
    purchaseApplications,
    bankTransfers,
    deposits,
    depositLines,
    importedTransactions,
    reconciliations,
    reconciliationEntries,
    inventoryTransactions,
    inventoryAdjustments,
    inventoryAdjustmentLines,
    bookmarks,
    bankRules,
    reportNotes,
    ledgerFiles,
    auditLogs,
    stores,
    posRegisters,
    posPaymentMethods,
    note: {
      includesStoresAndTills: true,
      includesPosSessionsOrders: false,
      message:
        'Stores, POS registers, and payment methods are in this file. Open POS sessions/orders are not.',
    },
  }
}

const downloads = join(homedir(), 'Downloads')
mkdirSync(downloads, { recursive: true })
const day = new Date().toISOString().slice(0, 10)

const organizations = await db.organization.findMany({
  select: { id: true, name: true },
  orderBy: { name: 'asc' },
})

const written = []
const databases = []

for (const org of organizations) {
  const backup = await companyBackup(org.id)
  databases.push(backup)
  const file = join(downloads, `${slugify(org.name)}-backup-${day}.json`)
  writeFileSync(file, json(backup), 'utf8')
  written.push({
    company: org.name,
    file,
    bytes: Buffer.byteLength(json(backup)),
    takenAt: backup.takenAt,
    stores: backup.stores.length,
    posRegisters: backup.posRegisters.length,
    customers: backup.customers.length,
    journals: backup.journals.length,
    salesDocuments: backup.salesDocuments.length,
  })
}

const bundleFile = join(downloads, `databases-backup-${day}.json`)
const bundle = { version: 2, takenAt: new Date().toISOString(), databases }
writeFileSync(bundleFile, json(bundle), 'utf8')
written.push({
  company: 'ALL (bundle)',
  file: bundleFile,
  bytes: Buffer.byteLength(json(bundle)),
  takenAt: bundle.takenAt,
})

console.log(JSON.stringify({ downloads, written }, null, 2))
await db.$disconnect()
