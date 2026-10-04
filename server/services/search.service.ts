import 'server-only'

import { HELP_TOPICS } from '@/lib/help-topics'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export type SearchHit = { label: string; href: string; group: string }

export async function searchBooks(ctx: OrgContext, query: string): Promise<SearchHit[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const contains = { contains: q, mode: 'insensitive' as const }
  const [customers, vendors, sales, purchases, journals] = await Promise.all([
    ctx.permissions.has('customer:read')
      ? db.customer.findMany({
          where: { orgId: ctx.orgId, displayName: contains },
          select: { id: true, displayName: true },
          take: 5,
        })
      : [],
    ctx.permissions.has('vendor:read')
      ? db.vendor.findMany({
          where: { orgId: ctx.orgId, displayName: contains },
          select: { id: true, displayName: true },
          take: 5,
        })
      : [],
    ctx.permissions.has('invoice:read')
      ? db.salesDocument.findMany({
          where: { orgId: ctx.orgId, OR: [{ number: contains }, { reference: contains }] },
          select: { id: true, number: true, type: true },
          take: 5,
        })
      : [],
    ctx.permissions.has('bill:read')
      ? db.purchaseDocument.findMany({
          where: { orgId: ctx.orgId, OR: [{ number: contains }, { reference: contains }] },
          select: { id: true, number: true, type: true },
          take: 5,
        })
      : [],
    ctx.permissions.has('journal:read')
      ? db.journal.findMany({
          where: { orgId: ctx.orgId, journalNumber: contains, status: { not: 'DELETED' } },
          select: { id: true, journalNumber: true },
          take: 5,
        })
      : [],
  ])

  const hits: SearchHit[] = [
    ...customers.map((row) => ({ label: row.displayName, href: `/customers/${row.id}`, group: 'Customers' })),
    ...vendors.map((row) => ({ label: row.displayName, href: `/vendors/${row.id}`, group: 'Vendors' })),
    ...sales.map((row) => ({
      label: `${row.number}`,
      href: `/sales/${salesPath(row.type)}/${row.id}`,
      group: 'Sales',
    })),
    ...purchases.map((row) => ({
      label: `${row.number}`,
      href: `/purchases/${purchasePath(row.type)}/${row.id}`,
      group: 'Purchases',
    })),
    ...journals.map((row) => ({ label: row.journalNumber, href: `/journals/${row.id}`, group: 'Journals' })),
    ...HELP_TOPICS.filter((topic) => `${topic.title} ${topic.text}`.toLowerCase().includes(q.toLowerCase())).map(
      (topic) => ({ label: topic.title, href: topic.href, group: 'Help' }),
    ),
  ]

  return hits.slice(0, 20)
}

function salesPath(type: string) {
  if (type === 'ESTIMATE') return 'estimates'
  if (type === 'SALES_RECEIPT') return 'sales-receipts'
  if (type === 'CREDIT_MEMO') return 'credit-memos'
  if (type === 'REFUND_RECEIPT') return 'refunds'
  return 'invoices'
}

function purchasePath(type: string) {
  if (type === 'EXPENSE') return 'expenses'
  if (type === 'VENDOR_CREDIT') return 'vendor-credits'
  if (type === 'PURCHASE_ORDER') return 'purchase-orders'
  return 'bills'
}
