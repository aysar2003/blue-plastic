import type { Metadata } from 'next'
import Link from 'next/link'

import { createAsnAction, receiveAsnAction } from '@/app/(app)/inventory/asn/actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as asn from '@/server/services/asn.service'

export const metadata: Metadata = { title: 'ASN' }

export default async function InventoryAsnPage() {
  const ctx = await requireOrgContext('inventory:read')
  const [shipments, vendors, items, orders] = await Promise.all([
    asn.listAsn(ctx),
    db.vendor.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 500,
    }),
    db.item.findMany({
      where: { orgId: ctx.orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 500,
    }),
    db.purchaseDocument.findMany({
      where: { orgId: ctx.orgId, type: 'PURCHASE_ORDER', deletedAt: null },
      select: { id: true, number: true },
      orderBy: { date: 'desc' },
      take: 100,
    }),
  ])

  return (
    <>
      <PageHeader
        title="Advance ship notices"
        description="Expected inbound shipments against vendors and POs. Receive posts a bill and stock against the linked purchase order."
        actions={
          <Link href="/inventory/bins" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Bins & picks
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <form action={createAsnAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              ASN number
              <Input name="number" required className="mt-1" placeholder="ASN-001" />
            </label>
            <label className="text-sm">
              Vendor
              <NativeSelect name="vendorId" required className="mt-1">
                <option value="">Choose…</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.displayName}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Purchase order
              <NativeSelect name="purchaseDocumentId" className="mt-1">
                <option value="">None</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.number}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Expected
              <Input name="expectedAt" type="date" className="mt-1" />
            </label>
            <label className="text-sm">
              Item
              <NativeSelect name="itemId" className="mt-1">
                <option value="">Optional</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Qty
              <Input name="quantity" defaultValue="1" className="mt-1" />
            </label>
            <label className="text-sm sm:col-span-2">
              Description
              <Input name="description" className="mt-1" placeholder="Line description" />
            </label>
            <div className="flex items-end">
              <button type="submit" className={buttonVariants({ size: 'sm' })}>
                Create ASN
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {shipments.length === 0 ? (
        <EmptyState title="No ASNs" description="Create an expected inbound notice above." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>PO</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.map((shipment) => (
              <TableRow key={shipment.id}>
                <TableCell className="font-medium">{shipment.number}</TableCell>
                <TableCell>{shipment.vendor.displayName}</TableCell>
                <TableCell>{shipment.purchaseDocument?.number ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {shipment.lines
                    .map((line) => `${line.description} × ${line.quantity.toString()}`)
                    .join(' · ')}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{shipment.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {shipment.status === 'EXPECTED' ? (
                    <form action={receiveAsnAction}>
                      <input type="hidden" name="asnId" value={shipment.id} />
                      <button type="submit" className={buttonVariants({ size: 'sm' })}>
                        Receive into stock
                      </button>
                    </form>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
