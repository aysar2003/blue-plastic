/**
 * Inspect Markan company vs what a 10-day-ago restore would mean.
 * Read-only except it prints counts — no restore runs here.
 */
process.loadEnvFile('.env')
const { PrismaPg } = await import('@prisma/adapter-pg')
const { PrismaClient } = await import('@prisma/client')
const { existsSync, readFileSync, readdirSync } = await import('node:fs')
const { join } = await import('node:path')

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const orgs = await db.organization.findMany({
  where: { name: { contains: 'Markan', mode: 'insensitive' } },
  select: { id: true, name: true, createdAt: true, updatedAt: true, baseCurrency: true },
  orderBy: { name: 'asc' },
})

if (orgs.length === 0) {
  console.log(JSON.stringify({ error: 'No company named Markan found.' }, null, 2))
  await db.$disconnect()
  process.exit(1)
}

const reports = []
for (const org of orgs) {
  const where = { orgId: org.id }
  const [
    customers,
    vendors,
    items,
    journals,
    salesDocs,
    purchaseDocs,
    customerPayments,
    billPayments,
    bankTransfers,
    deposits,
    inventoryTx,
    accounts,
  ] = await Promise.all([
    db.customer.count({ where }),
    db.vendor.count({ where }),
    db.item.count({ where }),
    db.journal.count({ where }),
    db.salesDocument.count({ where }),
    db.purchaseDocument.count({ where }),
    db.customerPayment.count({ where }),
    db.billPayment.count({ where }),
    db.bankTransfer.count({ where }),
    db.deposit.count({ where }),
    db.inventoryTransaction.count({ where }),
    db.ledgerAccount.count({ where }),
  ])

  const recentSales = await db.salesDocument.findMany({
    where,
    orderBy: { date: 'desc' },
    take: 5,
    select: { type: true, number: true, date: true, total: true, status: true },
  })
  const recentJournals = await db.journal.findMany({
    where,
    orderBy: { date: 'desc' },
    take: 5,
    select: { journalNumber: true, date: true, memo: true, status: true },
  })

  reports.push({
    company: org,
    liveCounts: {
      accounts,
      customers,
      vendors,
      items,
      journals,
      salesDocuments: salesDocs,
      purchaseDocuments: purchaseDocs,
      customerPayments,
      billPayments,
      bankTransfers,
      deposits,
      inventoryMovements: inventoryTx,
    },
    recentSales: recentSales.map((row) => ({
      ...row,
      date: row.date.toISOString().slice(0, 10),
      total: String(row.total),
    })),
    recentJournals: recentJournals.map((row) => ({
      ...row,
      date: row.date.toISOString().slice(0, 10),
    })),
  })
}

const backupHints = []
for (const name of readdirSync(process.cwd())) {
  if (!name.toLowerCase().includes('backup') && !name.toLowerCase().includes('markan')) continue
  if (!name.endsWith('.json')) continue
  const path = join(process.cwd(), name)
  if (!existsSync(path)) continue
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    const companies = Array.isArray(raw.databases)
      ? raw.databases
      : raw.organization
        ? [raw]
        : []
    for (const entry of companies) {
      const o = entry.organization
      if (!o?.name) continue
      if (!String(o.name).toLowerCase().includes('markan')) continue
      backupHints.push({
        file: name,
        companyName: o.name,
        organizationId: o.id,
        takenAt: entry.takenAt ?? raw.takenAt ?? null,
        customers: Array.isArray(entry.customers) ? entry.customers.length : null,
        journals: Array.isArray(entry.journals) ? entry.journals.length : null,
        salesDocuments: Array.isArray(entry.salesDocuments) ? entry.salesDocuments.length : null,
      })
    }
  } catch {
    // skip unreadable
  }
}

console.log(
  JSON.stringify(
    {
      liveCompanies: reports,
      markanBackupFilesOnDisk: backupHints,
      restoreMeaning: {
        whatReturns: 'Everything that was inside the chosen backup file (books as of takenAt).',
        whatIsLostForever:
          'Everything entered in Markan AFTER that backup moment — invoices, payments, journals, stock moves, new customers/items created after the backup.',
        whatIsNotLost:
          'Other companies on the system are untouched. Users/sign-in stay. The backup JSON file on your computer stays.',
        notInBackup:
          'POS tills/sessions and store layouts are not restored from backup (accounting books are).',
      },
    },
    null,
    2,
  ),
)

await db.$disconnect()
