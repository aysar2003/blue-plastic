import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ODOO } from '@/lib/odoo-brand'
import { requireOrgContext } from '@/server/auth/context'
import * as posService from '@/server/services/pos.service'

export const metadata: Metadata = { title: 'POS Sessions' }

export default async function PosSessionsPage() {
  const ctx = await requireOrgContext('pos:read')
  const sessions = await posService.listSessions(ctx)

  return (
    <div>
      <PageHeader
        title="Sessions"
        description="Cash-control periods — opening float, orders, and closing count."
        actions={
          <Link href="/pos" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            ← Dashboard
          </Link>
        }
      />

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Opened</TableHead>
              <TableHead>Register</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Opening</TableHead>
              <TableHead>Closing</TableHead>
              <TableHead>Change returned</TableHead>
              <TableHead className="text-right">Orders</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="text-muted-foreground">{session.dateLabel}</TableCell>
                <TableCell>
                  {session.status === 'OPEN' ? (
                    <Link href={`/pos/${session.registerId}`} className="text-primary hover:underline">
                      {session.registerName}
                    </Link>
                  ) : (
                    session.registerName
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className="rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white"
                    style={{
                      background: session.status === 'OPEN' ? ODOO.teal : 'var(--muted-foreground)',
                    }}
                  >
                    {session.status}
                  </span>
                </TableCell>
                <TableCell className="tabular">{session.openingCash}</TableCell>
                <TableCell className="tabular text-muted-foreground">
                  {session.closingCash ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {session.changeLabel ?? '—'}
                  {session.netByAccount.length > 0 ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground/80">
                      Net{' '}
                      {session.netByAccount.map((account) => `${account.name} ${account.net}`).join(' · ')}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular">{session.orderCount}</TableCell>
              </TableRow>
            ))}
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No sessions yet. Open a register from the dashboard.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
