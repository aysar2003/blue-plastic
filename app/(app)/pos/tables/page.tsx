import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requireOrgContext } from '@/server/auth/context'
import * as dining from '@/server/services/dining-table.service'

import { billTable, clearTable, saveTable, seatTable } from './actions'

export const metadata: Metadata = { title: 'Dining tables' }

export default async function PosTablesPage() {
  const ctx = await requireOrgContext('pos:read')
  const tables = await dining.listTables(ctx)
  const canManage = ctx.permissions.has('pos:manage')
  const canSell = ctx.permissions.has('pos:sell')

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <PageHeader
        title="Dining tables"
        description="Floor map for restaurant service. Seat guests, then ring the sale on POS."
      />

      {canManage ? (
        <form action={saveTable} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" required placeholder="T1" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="Window 1" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seats">Seats</Label>
            <Input id="seats" name="seats" type="number" min={1} defaultValue={4} />
          </div>
          <div className="flex items-end">
            <Button type="submit">Add table</Button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => (
          <div key={table.id} className="rounded-lg border border-border p-4">
            <p className="text-sm font-semibold">
              {table.code} · {table.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {table.seats} seats · {table.status}
              {table.zone ? ` · ${table.zone}` : ''}
            </p>
            {canSell ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={seatTable}>
                  <input type="hidden" name="tableId" value={table.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    Seat
                  </Button>
                </form>
                <form action={billTable}>
                  <input type="hidden" name="tableId" value={table.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    Bill
                  </Button>
                </form>
                <form action={clearTable}>
                  <input type="hidden" name="tableId" value={table.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Clear
                  </Button>
                </form>
              </div>
            ) : null}
          </div>
        ))}
        {tables.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tables yet. Add the floor layout above.</p>
        ) : null}
      </div>
    </div>
  )
}
