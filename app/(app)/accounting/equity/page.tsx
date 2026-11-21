import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, toCalendarDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as equityService from '@/server/services/equity-register.service'
import * as shareholderService from '@/server/services/shareholder.service'
import { ownersEquityStatement, totalEquity } from '@/server/reports/owners-equity-statement'

import { allocatePatronage, postEquityEvent, saveShareholder } from './actions'

export const metadata: Metadata = { title: 'Equity' }

export default async function EquityPage() {
  const ctx = await requireOrgContext('journal:post')
  const [shareholders, events, banks, statement] = await Promise.all([
    shareholderService.list(ctx),
    equityService.listEvents(ctx),
    equityService.listBanks(ctx),
    ownersEquityStatement(ctx),
  ])
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Equity"
        description="Shareholders register with ownership from shares, plus contributions, draws, and dividends."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/reports/owners-equity">Owner&apos;s equity statement</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/api/exports/equity-register">Shareholder CSV</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/api/exports/equity-movement">Period movement CSV</a>
            </Button>
          </div>
        }
      />

      <Card className="mb-6 grid max-w-2xl gap-2 p-4 text-sm">
        <p>
          Total equity (capital + retained earnings):{' '}
          <strong>{formatMoney(totalEquity(statement).toFixed(2), currency)}</strong>
        </p>
        <p className="text-muted-foreground">
          Recorded events — contributions {formatMoney(statement.contributions.toFixed(2), currency)},
          draws {formatMoney(statement.draws.toFixed(2), currency)}, dividends{' '}
          {formatMoney(statement.dividends.toFixed(2), currency)}.
        </p>
        <Link href="/accounting/equity-contribution" className="text-primary text-sm hover:underline">
          Legacy contribution form
        </Link>
        <Link href="/reports/consolidation" className="text-primary text-sm hover:underline">
          Group consolidation (P&amp;L and balance sheet)
        </Link>
      </Card>

      <div className="mb-8 grid gap-8 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Shareholders</h2>
          <form action={saveShareholder} className="mb-4 grid gap-2">
            <div>
              <Label htmlFor="sh-name">Name</Label>
              <Input id="sh-name" name="name" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="sh-shares">Shares</Label>
                <Input id="sh-shares" name="shares" defaultValue="0" />
              </div>
              <div>
                <Label htmlFor="sh-pct">Ownership %</Label>
                <Input id="sh-pct" name="ownershipPercent" defaultValue="0" />
              </div>
            </div>
            <Button type="submit" size="sm">
              Add shareholder
            </Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Shares</TableHead>
                <TableHead>%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shareholders.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.shares.toString()}</TableCell>
                  <TableCell>{row.ownershipPercent.toString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-medium">Patronage allocation</h2>
          <p className="text-muted-foreground mb-3 text-sm">
            Allocate % of year net to MEMBER shareholders by linked customer purchases. Posts an
            equity event per member.
          </p>
          <p className="mb-3">
            <Link href="/api/equity/patronage" className="text-primary text-sm hover:underline">
              Member patronage CSV
            </Link>
          </p>
          <form action={allocatePatronage} className="mb-6 grid gap-2">
            <div>
              <Label htmlFor="patronage-year">Year</Label>
              <Input id="patronage-year" name="year" type="number" defaultValue={new Date().getFullYear() - 1} />
            </div>
            <div>
              <Label htmlFor="percentOfNet">% of net income</Label>
              <Input id="percentOfNet" name="percentOfNet" defaultValue="5" />
            </div>
            <Button type="submit" size="sm" variant="secondary">
              Allocate patronage
            </Button>
          </form>
          <h2 className="mb-3 font-medium">Post equity event</h2>
          <form action={postEquityEvent} className="grid gap-2">
            <div>
              <Label htmlFor="kind">Kind</Label>
              <select id="kind" name="kind" className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="CONTRIBUTION">Contribution</option>
                <option value="DRAW">Draw</option>
                <option value="DIVIDEND">Dividend</option>
              </select>
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" required />
            </div>
            <div>
              <Label htmlFor="bankAccountId">Bank account</Label>
              <select
                id="bankAccountId"
                name="bankAccountId"
                required
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.code} — {bank.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="shareholderId">Shareholder (optional)</Label>
              <select
                id="shareholderId"
                name="shareholderId"
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {shareholders.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm">
              Post journal
            </Button>
          </form>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 font-medium">Recent events</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Shareholder</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDate(toCalendarDate(row.date))}</TableCell>
                <TableCell>{row.kind}</TableCell>
                <TableCell>{row.shareholder?.name ?? '—'}</TableCell>
                <TableCell className="text-right">{formatMoney(row.amount.toFixed(2), currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
