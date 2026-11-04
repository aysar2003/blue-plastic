import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { KITCHEN_LEGAL, nextKitchenStatus, type KitchenStatus } from '@/lib/erp/kitchen-ticket'
import { requireOrgContext } from '@/server/auth/context'
import * as kitchen from '@/server/services/kitchen.service'

import { bumpTicket, openTicket } from './actions'

export const metadata: Metadata = { title: 'Kitchen display' }

export default async function KitchenPage() {
  const ctx = await requireOrgContext('pos:read')
  const tickets = await kitchen.listTickets(ctx)
  const canSell = ctx.permissions.has('pos:sell')

  return (
    <>
      <PageHeader title="Kitchen display" description="Open a ticket, fire it, mark ready, then done." />
      <p className="mb-4 max-w-2xl text-xs text-muted-foreground">{KITCHEN_LEGAL}</p>
      {canSell ? (
        <Card className="mb-6 max-w-lg space-y-2 p-4">
          <form action={openTicket} className="space-y-2">
            <div className="flex gap-2">
              <Input name="tableLabel" placeholder="Table / counter" />
              <Input name="covers" placeholder="Covers" className="w-24" />
            </div>
            <textarea
              name="lines"
              required
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder={'Chapati x 2\nShaah x 1'}
            />
            <Button type="submit" size="sm">
              Send to kitchen
            </Button>
          </form>
        </Card>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(['OPEN', 'FIRED', 'READY', 'DONE'] as const).map((status) => (
          <Card key={status} className="p-3">
            <h2 className="mb-2 text-sm font-semibold">{status}</h2>
            <ul className="space-y-2 text-sm">
              {tickets
                .filter((row) => row.status === status)
                .map((row) => (
                  <li key={row.id} className="rounded-md border px-2 py-1">
                    <div className="font-medium">{row.tableLabel || 'Walk-in'}</div>
                    {row.lines.map((line) => (
                      <div key={line.name}>
                        {line.qty} × {line.name}
                      </div>
                    ))}
                    {canSell && nextKitchenStatus(row.status as KitchenStatus) ? (
                      <form action={bumpTicket} className="mt-1">
                        <input type="hidden" name="id" value={row.id} />
                        <Button type="submit" size="sm" variant="secondary">
                          {nextKitchenStatus(row.status as KitchenStatus)}
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  )
}
