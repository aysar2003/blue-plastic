import Module from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stub = path.join(root, 'tests/stubs/server-only.ts')
const orig = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'server-only') return stub
  return orig.call(this, request, parent, isMain, options)
}
process.chdir(root)
try {
  process.loadEnvFile('.env')
} catch {
  /* */
}

const { db } = await import(pathToFileURL(path.join(root, 'server/db.ts')).href)
const orgs = await db.organization.findMany({
  select: { id: true, name: true },
  orderBy: { name: 'asc' },
})
for (const o of orgs) {
  const [customers, items, accounts, journals, invoices, bills] = await Promise.all([
    db.customer.count({ where: { orgId: o.id } }),
    db.item.count({ where: { orgId: o.id } }),
    db.ledgerAccount.count({ where: { orgId: o.id } }),
    db.journal.count({ where: { orgId: o.id } }),
    db.salesDocument.count({ where: { orgId: o.id, type: 'INVOICE' } }),
    db.purchaseDocument.count({ where: { orgId: o.id, type: 'BILL' } }),
  ])
  console.log(
    JSON.stringify({
      name: o.name,
      id: o.id,
      customers,
      items,
      accounts,
      journals,
      invoices,
      bills,
    }),
  )
}
await db.$disconnect()
