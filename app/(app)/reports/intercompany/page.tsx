import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as icMatch from '@/server/services/intercompany-match.service'

import { confirmIcMatchAction, unmatchIcAction } from './actions'

export const metadata: Metadata = { title: 'Intercompany matches' }

export default async function IntercompanyMatchPage() {
  const ctx = await requireOrgContext('report:read')
  const [unmatched, suggestions, matches] = await Promise.all([
    icMatch.listUnmatchedIcJournals(ctx),
    icMatch.suggestMatches(ctx),
    icMatch.listMatches(ctx),
  ])
  const currency = ctx.organization.baseCurrency
  const canManage = ctx.permissions.has('journal:create') || ctx.role === 'OWNER' || ctx.role === 'ADMIN'

  return (
    <>
      <PageHeader
        title="Intercompany matches"
        description="Pair [IC] journals across companies in the group. Unmatched IC blocks the group close checklist."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/reports/group-close"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Group close
            </Link>
            <Link
              href="/reports/consolidation"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Consolidation
            </Link>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Suggested pairs</CardTitle>
          <CardDescription>
            Same absolute amount, different companies, within 7 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No automatic suggestions.</p>
          ) : (
            <ul className="space-y-3">
              {suggestions.map((pair) => (
                <li
                  key={`${pair.aId}-${pair.bId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                >
                  <span>
                    {pair.a.orgName} {pair.a.number} ↔ {pair.b.orgName} {pair.b.number} ·{' '}
                    {formatMoney(pair.amount, currency)}
                  </span>
                  {canManage ? (
                    <form action={confirmIcMatchAction}>
                      <input type="hidden" name="journalAId" value={pair.aId} />
                      <input type="hidden" name="journalBId" value={pair.bId} />
                      <Button type="submit" size="sm">
                        Confirm match
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Unmatched [IC] journals</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {unmatched.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">All IC journals are matched.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Journal</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Memo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatched.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.orgName}</TableCell>
                    <TableCell>
                      <Link href={`/journals/${row.id}`} className="hover:underline">
                        {row.journalNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular">{row.date}</TableCell>
                    <TableCell className="text-right tabular">
                      {formatMoney(row.amount, currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.memo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canManage && unmatched.length >= 2 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Manual match</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={confirmIcMatchAction} className="flex flex-wrap items-end gap-3">
              <label className="text-xs">
                Journal A id
                <Input name="journalAId" required className="mt-1 w-56 font-mono text-xs" />
              </label>
              <label className="text-xs">
                Journal B id
                <Input name="journalBId" required className="mt-1 w-56 font-mono text-xs" />
              </label>
              <label className="text-xs">
                Notes
                <Input name="notes" className="mt-1 w-40" />
              </label>
              <Button type="submit" size="sm" variant="secondary">
                Match
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confirmed matches</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {matches.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">None yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pair</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Matched</TableHead>
                  {canManage ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.a.orgName} {row.a.number} ↔ {row.b.orgName} {row.b.number}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatMoney(row.amount, currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.matchedAt.slice(0, 10)}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <form action={unmatchIcAction}>
                          <input type="hidden" name="matchId" value={row.id} />
                          <Button type="submit" size="sm" variant="outline">
                            Unmatch
                          </Button>
                        </form>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
