import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as pricing from '@/server/services/pricing.service'

import {
  assignCustomerListAction,
  savePriceListAction,
  savePromotionAction,
} from './actions'

export const metadata: Metadata = { title: 'Price lists & promos' }

export default async function PricingSettingsPage() {
  const ctx = await requireOrgContext('item:update')
  const [lists, promos, items, customers] = await Promise.all([
    pricing.listPriceLists(ctx),
    pricing.listPromotions(ctx),
    db.item.findMany({
      where: { orgId: ctx.orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 400,
    }),
    db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true, priceListId: true },
      orderBy: { displayName: 'asc' },
      take: 400,
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader
        title="Price lists & promotions"
        description="Named lists beyond retail/wholesale, plus simple % off windows. No loyalty."
        actions={
          <Link href="/settings/features" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Apps & features
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New price list</CardTitle>
          <CardDescription>Add one item price now; edit more from the list later.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={savePriceListAction} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Trade A" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="itemId">Item</Label>
              <NativeSelect id="itemId" name="itemId">
                <option value="">Optional first line</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="unitPrice">Unit price</Label>
              <Input id="unitPrice" name="unitPrice" placeholder="0.00" />
            </div>
            <Button type="submit" className="sm:col-span-2 w-fit">
              Create list
            </Button>
          </form>
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
            {lists.map((list) => (
              <li key={list.id}>
                <span className="text-foreground">{list.name}</span> · {list.items.length} item
                {list.items.length === 1 ? '' : 's'} · {list._count.customers} customer
                {list._count.customers === 1 ? '' : 's'}
              </li>
            ))}
            {lists.length === 0 ? <li>No lists yet.</li> : null}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assign customer to a list</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={assignCustomerListAction} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="customerId">Customer</Label>
              <NativeSelect id="customerId" name="customerId" required>
                <option value="">Choose…</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.displayName}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="priceListId">Price list</Label>
              <NativeSelect id="priceListId" name="priceListId">
                <option value="">Clear</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" variant="secondary">
              Assign
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">% promotion</CardTitle>
          <CardDescription>Date window; leave item blank for all products.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={savePromotionAction} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="promoName">Name</Label>
              <Input id="promoName" name="name" required placeholder="Weekend sale" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="promoItem">Item</Label>
              <NativeSelect id="promoItem" name="itemId">
                <option value="">All items</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="percentOff">Percent off</Label>
              <Input id="percentOff" name="percentOff" required placeholder="10" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="startsOn">Starts</Label>
              <Input id="startsOn" name="startsOn" type="date" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="endsOn">Ends</Label>
              <Input id="endsOn" name="endsOn" type="date" required />
            </div>
            <Button type="submit" className="sm:col-span-2 w-fit">
              Save promotion
            </Button>
          </form>
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
            {promos.map((promo) => (
              <li key={promo.id}>
                <span className="text-foreground">{promo.name}</span> · {promo.percentOff.toString()}%
                · {promo.item?.name ?? 'All items'} ·{' '}
                {promo.startsOn.toISOString().slice(0, 10)} → {promo.endsOn.toISOString().slice(0, 10)}
                {promo.isActive ? '' : ' (off)'}
              </li>
            ))}
            {promos.length === 0 ? <li>No promotions yet.</li> : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
