import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { requireOrgContext } from '@/server/auth/context'
import * as crm from '@/server/services/crm.service'

import { completeTicket, createTicket } from './actions'

export const metadata: Metadata = { title: 'Tickets' }

export default async function CustomerTicketsPage() {
  const ctx = await requireOrgContext('customer:read')
  const board = await crm.listBoard(ctx)
  const tickets = board.activities.filter((row) => row.kind === 'TASK' || row.kind === 'NOTE')

  return (
    <>
      <PageHeader
        title="Support tickets"
        description="Customer issues and follow-ups. Open work stays here until marked done."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/customers/pipeline">Pipeline</Link>
          </Button>
        }
      />
      <Card className="mb-6 max-w-lg space-y-3 p-4">
        <form action={createTicket} className="space-y-2">
          <NativeSelect name="customerId" required disabled={board.customers.length === 0}>
            {board.customers.length === 0 ? (
              <option value="">Add a customer first</option>
            ) : (
              board.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName}
                </option>
              ))
            )}
          </NativeSelect>
          <Input name="subject" placeholder="Subject" required />
          <Input name="notes" placeholder="Details (optional)" />
          <Input name="dueAt" type="datetime-local" />
          <Button type="submit" size="sm" disabled={board.customers.length === 0}>
            Open ticket
          </Button>
        </form>
      </Card>
      <ul className="space-y-2 text-sm">
        {tickets.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
            <span>
              {row.subject} · {row.customer.displayName}
              {row.dueAt ? ` · due ${row.dueAt.toISOString().slice(0, 10)}` : ''}
            </span>
            {row.doneAt ? (
              <span className="text-muted-foreground">done</span>
            ) : (
              <form action={completeTicket}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm" variant="secondary">
                  Close
                </Button>
              </form>
            )}
          </li>
        ))}
        {tickets.length === 0 ? (
          <li className="text-muted-foreground">No tickets yet.</li>
        ) : null}
      </ul>
    </>
  )
}
