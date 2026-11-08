import type { Metadata } from 'next'
import Link from 'next/link'

import {
  addChargeAction,
  cancelVisitAction,
  closeVisitAction,
  openVisitAction,
} from '@/app/(app)/hospital/actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as hospital from '@/server/services/hospital.service'

export const metadata: Metadata = { title: 'Patient visits' }

export default async function HospitalVisitsPage() {
  const ctx = await requireOrgContext('invoice:read')
  const [openVisits, recent, customers, items, classes] = await Promise.all([
    hospital.listOpenVisits(ctx),
    hospital.listRecentVisits(ctx),
    db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 500,
    }),
    db.item.findMany({
      where: { orgId: ctx.orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true, salesPrice: true, sku: true },
      orderBy: { name: 'asc' },
      take: 500,
    }),
    db.trackingCategory.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Patient visits"
        description="Open a visit, add billable service charges, then close to raise an invoice. No clinical chart."
        actions={
          <Link href="/hospital" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Hospital hub
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <form action={openVisitAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              Patient
              <NativeSelect name="customerId" required className="mt-1">
                <option value="">Choose…</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.displayName}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Department
              <NativeSelect name="trackingCategoryId" className="mt-1">
                <option value="">None</option>
                {classes.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Payer
              <Input name="payerName" className="mt-1" placeholder="Self-pay / insurer" />
            </label>
            <label className="text-sm">
              Payer / policy ref
              <Input name="payerRef" className="mt-1" placeholder="Optional" />
            </label>
            <label className="text-sm sm:col-span-2">
              Notes
              <Input name="notes" className="mt-1" placeholder="Optional billing note" />
            </label>
            <div className="flex items-end">
              <button type="submit" className={buttonVariants({ size: 'sm' })}>
                Open visit
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <h2 className="mb-2 text-sm font-semibold">Open visits</h2>
      {openVisits.length === 0 ? (
        <EmptyState
          title="No open visits"
          description="Open a visit for a patient, then add service charges."
        />
      ) : (
        <div className="mb-8 space-y-4">
          {openVisits.map((visit) => {
            const balance = hospital.visitBalance(visit.charges)
            return (
              <Card key={visit.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{visit.customer.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {visit.trackingCategory?.name ?? 'No department'}
                        {visit.payerName ? ` · ${visit.payerName}` : ''}
                        {visit.payerRef ? ` · ${visit.payerRef}` : ''}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <Badge variant="secondary">OPEN</Badge>
                      <p className="mt-1 tabular">{formatMoney(balance, currency)}</p>
                    </div>
                  </div>

                  <form action={addChargeAction} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <input type="hidden" name="visitId" value={visit.id} />
                    <NativeSelect name="itemId" required className="text-sm">
                      <option value="">Service…</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                          {item.sku ? ` (${item.sku})` : ''}
                        </option>
                      ))}
                    </NativeSelect>
                    <Input name="quantity" defaultValue="1" placeholder="Qty" />
                    <Input name="unitPrice" placeholder="Price (blank = item)" />
                    <Input name="billCode" placeholder="Bill code" />
                    <Input name="description" placeholder="Description override" />
                    <button type="submit" className={buttonVariants({ size: 'sm' })}>
                      Add charge
                    </button>
                  </form>

                  <div className="flex flex-wrap gap-2">
                    <form action={closeVisitAction}>
                      <input type="hidden" name="visitId" value={visit.id} />
                      <button
                        type="submit"
                        className={buttonVariants({ size: 'sm' })}
                        disabled={visit.charges.length === 0}
                      >
                        Close → invoice
                      </button>
                    </form>
                    <form action={cancelVisitAction}>
                      <input type="hidden" name="visitId" value={visit.id} />
                      <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                        Cancel
                      </button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold">Recent visits</h2>
      {recent.length === 0 ? (
        <EmptyState title="Nothing yet" description="Closed and cancelled visits will show here." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Dept</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.map((visit) => (
              <TableRow key={visit.id}>
                <TableCell className="font-medium">{visit.customer.displayName}</TableCell>
                <TableCell>{visit.trackingCategory?.name ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline">{visit.status}</Badge>
                </TableCell>
                <TableCell>
                  {visit.salesDocument ? (
                    <Link
                      href={`/sales/invoices/${visit.salesDocument.id}`}
                      className="underline underline-offset-4"
                    >
                      {visit.salesDocument.number} ·{' '}
                      {formatMoney(visit.salesDocument.total.toString(), currency)}
                    </Link>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
