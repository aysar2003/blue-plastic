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

export default async function InventoryAsnPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const ctx = await requireOrgContext('inventory:read')
  const query = await searchParams
  const [shipments, vendors, items, orders, dockDays, discrepancies] = await Promise.all([
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
    asn.dockCalendar(ctx),
    asn.discrepancyReport(ctx),
  ])
  const errorMessage = query.error?.trim() || null

  return (
    <>
      <PageHeader
        title="Advance ship notices"
        description="Expected inbound shipments against vendors and POs. Receive posts a bill and stock against the linked purchase order."
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/inventory/asn/discrepancy"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
              download
            >
              Discrepancy CSV
            </a>
            <Link href="/inventory/bins" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Bins & picks
            </Link>
          </div>
        }
      />

      {errorMessage ? (
        <Card className="mb-4 border-destructive/40 bg-destructive/5">
          <CardContent className="p-3 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

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
              Dock
              <Input name="dockName" className="mt-1" placeholder="Bay A" />
            </label>
            <label className="text-sm">
              Dock time
              <Input name="dockAt" type="datetime-local" className="mt-1" />
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
              <TableHead>Dock</TableHead>
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
                <TableCell className="text-sm text-muted-foreground">
                  {shipment.dockName || '—'}
                  {shipment.dockAt
                    ? ` · ${shipment.dockAt.toISOString().slice(0, 16).replace('T', ' ')}`
                    : ''}
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

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold">Dock calendar</h2>
        {dockDays.length === 0 ? (
          <EmptyState
            title="No dock appointments"
            description="Set a dock name and time on an expected ASN to see it on the calendar."
          />
        ) : (
          <div className="space-y-4">
            {dockDays.map((day) => (
              <Card key={day.date}>
                <CardContent className="p-4">
                  <p className="mb-2 font-medium">{day.date}</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Dock</TableHead>
                        <TableHead>ASN</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {day.slots.map((slot) => (
                        <TableRow key={slot.id}>
                          <TableCell className="tabular">{slot.time ?? '—'}</TableCell>
                          <TableCell>{slot.dockName}</TableCell>
                          <TableCell className="font-medium">{slot.number}</TableCell>
                          <TableCell>{slot.vendorName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{slot.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold">ASN vs PO discrepancy</h2>
        {discrepancies.length === 0 ? (
          <EmptyState
            title="No variances"
            description="Linked ASNs match remaining PO quantity. Over, short, or unmatched items appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ASN</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">ASN qty</TableHead>
                <TableHead className="text-right">PO open</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Kind</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discrepancies.map((row) => (
                <TableRow key={`${row.asnId}-${row.itemId}`}>
                  <TableCell>{row.asnNumber}</TableCell>
                  <TableCell>{row.poNumber}</TableCell>
                  <TableCell>{row.itemName}</TableCell>
                  <TableCell className="text-right tabular">{row.asnQty}</TableCell>
                  <TableCell className="text-right tabular">{row.poOpen}</TableCell>
                  <TableCell className="text-right tabular">{row.variance}</TableCell>
                  <TableCell>
                    <Badge variant={row.kind === 'over' || row.kind === 'asn_only' ? 'destructive' : 'outline'}>
                      {row.kind}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  )
}
