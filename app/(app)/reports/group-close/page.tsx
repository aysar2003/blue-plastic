import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as groupClose from '@/server/services/group-close.service'

import { setOwnershipAction } from './actions'

export const metadata: Metadata = { title: 'Group close' }

export default async function GroupClosePage({
  searchParams,
}: {
  searchParams?: Promise<{ asOf?: string }>
}) {
  const ctx = await requireOrgContext('report:read')
  const params = searchParams ? await searchParams : {}
  const checklist = await groupClose.groupCloseChecklist(ctx, params.asOf)
  const canEditOwnership =
    ctx.isSystemOwner || ctx.role === 'OWNER' || ctx.role === 'ADMIN'

  return (
    <>
      <PageHeader
        title="Group close checklist"
        description="Periods, unmatched intercompany, currency, and ownership before consolidating."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/reports/intercompany"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              IC matches
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

      <form className="mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="asOf">As of</Label>
          <Input id="asOf" name="asOf" type="date" defaultValue={checklist.asOf} />
        </div>
        <Button type="submit" variant="secondary">
          Refresh
        </Button>
      </form>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">
            {checklist.ready ? 'Ready to consolidate' : 'Not ready'}
          </CardTitle>
          <CardDescription>
            {checklist.blockers.length === 0
              ? 'All group close gates are clear for this date.'
              : checklist.blockers.join(' ')}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Unmatched IC: {checklist.unmatchedIcCount} · Currencies:{' '}
          {checklist.currencies.join(', ')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entities</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Ownership %</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checklist.entities.map((row) => (
                <TableRow key={row.orgId}>
                  <TableCell>
                    {row.name}
                    {row.isParent ? (
                      <span className="ml-2 text-xs text-muted-foreground">main</span>
                    ) : null}
                  </TableCell>
                  <TableCell>{row.baseCurrency}</TableCell>
                  <TableCell className="text-right">
                    {row.isParent ? (
                      <span className="tabular">100</span>
                    ) : canEditOwnership ? (
                      <form action={setOwnershipAction} className="inline-flex items-center gap-1">
                        <input type="hidden" name="orgId" value={row.orgId} />
                        <Input
                          name="ownershipPercent"
                          defaultValue={Number(row.ownershipPercent).toString()}
                          className="h-8 w-20 text-right tabular"
                        />
                        <Button type="submit" size="sm" variant="outline">
                          Save
                        </Button>
                      </form>
                    ) : (
                      <span className="tabular">{Number(row.ownershipPercent)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {row.periodLabel ?? '—'}
                    {row.periodId ? (
                      <>
                        {' '}
                        <Link
                          href={`/periods/${row.periodId}`}
                          className="underline underline-offset-2"
                        >
                          Open
                        </Link>
                      </>
                    ) : null}
                  </TableCell>
                  <TableCell>{row.periodStatus}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
