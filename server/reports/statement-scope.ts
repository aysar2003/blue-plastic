import 'server-only'

import type { ReportEntityFilters } from '@/server/reports/catalogue'
import { db, type Tx } from '@/server/db'

/**
 * Journals that belong to a customer / vendor / item / store filter.
 *
 * Financial statements are built from every posted line. When the user names a
 * party or an item, only journals caused by that party's documents (or that
 * item's stock movements) should count — otherwise the filter would only hide
 * rows after the fact and the totals would still be the whole company.
 *
 * Returns `null` when nothing was asked for (full books). Returns an empty
 * array when a filter was asked for but matched no journals (report is blank).
 */
export async function journalsForEntityFilters(
  orgId: string,
  filters: ReportEntityFilters | undefined,
  options: { client?: Tx } = {},
): Promise<string[] | null> {
  if (!filters) return null
  const { customerId, vendorId, itemId, storeId } = filters
  if (!customerId && !vendorId && !itemId && !storeId) return null

  const client = options.client ?? db
  const sets: string[][] = []

  if (customerId) {
    const rows = await client.$queryRaw<{ id: string }[]>`
      SELECT j.id
        FROM journals j
       WHERE j."orgId" = ${orgId}
         AND j.status NOT IN ('DRAFT', 'DELETED')
         AND (
           (j."sourceType" IN ('INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT')
             AND EXISTS (
               SELECT 1 FROM sales_documents d
                WHERE d.id = j."sourceId" AND d."customerId" = ${customerId}
             ))
           OR (j."sourceType" = 'CUSTOMER_PAYMENT'
             AND EXISTS (
               SELECT 1 FROM customer_payments p
                WHERE p.id = j."sourceId" AND p."customerId" = ${customerId}
             ))
         )
    `
    sets.push(rows.map((row) => row.id))
  }

  if (vendorId) {
    const rows = await client.$queryRaw<{ id: string }[]>`
      SELECT j.id
        FROM journals j
       WHERE j."orgId" = ${orgId}
         AND j.status NOT IN ('DRAFT', 'DELETED')
         AND (
           (j."sourceType" IN ('BILL', 'EXPENSE', 'VENDOR_CREDIT')
             AND EXISTS (
               SELECT 1 FROM purchase_documents d
                WHERE d.id = j."sourceId" AND d."vendorId" = ${vendorId}
             ))
           OR (j."sourceType" = 'BILL_PAYMENT'
             AND EXISTS (
               SELECT 1 FROM bill_payments p
                WHERE p.id = j."sourceId" AND p."vendorId" = ${vendorId}
             ))
         )
    `
    sets.push(rows.map((row) => row.id))
  }

  if (itemId) {
    const rows = await client.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT j.id
        FROM journals j
       WHERE j."orgId" = ${orgId}
         AND j.status NOT IN ('DRAFT', 'DELETED')
         AND (
           (j."sourceType" IN ('INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT')
             AND EXISTS (
               SELECT 1 FROM sales_document_lines l
                WHERE l."documentId" = j."sourceId" AND l."itemId" = ${itemId}
             ))
           OR (j."sourceType" IN ('BILL', 'EXPENSE', 'VENDOR_CREDIT')
             AND EXISTS (
               SELECT 1 FROM purchase_document_lines l
                WHERE l."documentId" = j."sourceId" AND l."itemId" = ${itemId}
             ))
           OR EXISTS (
               SELECT 1 FROM inventory_transactions t
                WHERE t."journalId" = j.id AND t."itemId" = ${itemId}
             )
         )
    `
    sets.push(rows.map((row) => row.id))
  }

  if (storeId) {
    const office = await client.store.findFirst({
      where: { id: storeId, orgId, isActive: true },
      select: { id: true, isOffice: true },
    })
    const rows = office?.isOffice
      ? await client.$queryRaw<{ id: string }[]>`
          SELECT DISTINCT j.id
            FROM journals j
            JOIN inventory_transactions t ON t."journalId" = j.id
           WHERE j."orgId" = ${orgId}
             AND j.status NOT IN ('DRAFT', 'DELETED')
             AND (t."storeId" = ${storeId} OR t."storeId" IS NULL)
        `
      : await client.$queryRaw<{ id: string }[]>`
          SELECT DISTINCT j.id
            FROM journals j
            JOIN inventory_transactions t ON t."journalId" = j.id
           WHERE j."orgId" = ${orgId}
             AND j.status NOT IN ('DRAFT', 'DELETED')
             AND t."storeId" = ${storeId}
        `
    // Also sales/purchase lines that named the store (no inventory journal).
    const docs = await client.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT j.id
        FROM journals j
       WHERE j."orgId" = ${orgId}
         AND j.status NOT IN ('DRAFT', 'DELETED')
         AND (
           (j."sourceType" IN ('INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT')
             AND EXISTS (
               SELECT 1 FROM sales_document_lines l
                WHERE l."documentId" = j."sourceId" AND l."storeId" = ${storeId}
             ))
           OR (j."sourceType" IN ('BILL', 'EXPENSE', 'VENDOR_CREDIT')
             AND EXISTS (
               SELECT 1 FROM purchase_document_lines l
                WHERE l."documentId" = j."sourceId" AND l."storeId" = ${storeId}
             ))
         )
    `
    sets.push([...new Set([...rows.map((row) => row.id), ...docs.map((row) => row.id)])])
  }

  if (sets.length === 0) return null
  if (sets.length === 1) return sets[0]

  // Multiple filters: intersection — customer AND item means that customer's sales of that item.
  let intersection = new Set(sets[0])
  for (let i = 1; i < sets.length; i++) {
    const next = new Set(sets[i])
    intersection = new Set([...intersection].filter((id) => next.has(id)))
  }
  return [...intersection]
}
