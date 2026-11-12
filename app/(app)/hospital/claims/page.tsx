import type { Metadata } from 'next'
import Link from 'next/link'

import { stampClaimsExportAction } from '@/app/(app)/hospital/actions'
import { PageHeader } from '@/components/data/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as hospital from '@/server/services/hospital.service'

export const metadata: Metadata = { title: 'Claims export' }

export default async function HospitalClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; includeExported?: string }>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const query = await searchParams
  const format = query.format === 'csv' ? 'csv' : 'json'
  const includeExported = query.includeExported === '1'
  const canStamp = ctx.permissions.has('invoice:create')
  const exported = await hospital.exportClaims(ctx, {
    format,
    status: 'CLOSED',
    includeExported,
    stamp: false,
  })

  return (
    <>
      <PageHeader
        title="Claims export"
        description="Billing claim rows for closed visits (payer + bill codes). Not a clinical coding system."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/hospital/visits" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Visits
            </Link>
            <Link
              href="/hospital/claims?format=json"
              className={buttonVariants({ variant: format === 'json' ? 'default' : 'outline', size: 'sm' })}
            >
              JSON
            </Link>
            <Link
              href={`/hospital/claims?format=csv${includeExported ? '&includeExported=1' : ''}`}
              className={buttonVariants({ variant: format === 'csv' ? 'default' : 'outline', size: 'sm' })}
            >
              CSV
            </Link>
            <Link
              href={`/hospital/claims?format=${format}&includeExported=1`}
              className={buttonVariants({ variant: includeExported ? 'default' : 'outline', size: 'sm' })}
            >
              Include already exported
            </Link>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Download payload</CardTitle>
          <CardDescription>
            {exported.rows.length} charge line{exported.rows.length === 1 ? '' : 's'} · format{' '}
            {exported.format.toUpperCase()}
            {includeExported ? ' · including previously stamped' : ' · unexported only'}
          </CardDescription>
        </CardHeader>
        {canStamp ? (
          <CardContent className="border-b pb-4">
            <form action={stampClaimsExportAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="format" value={format} />
              {includeExported ? <input type="hidden" name="includeExported" value="1" /> : null}
              <Button type="submit" size="sm" variant="secondary">
                Export and stamp as exported
              </Button>
            </form>
          </CardContent>
        ) : null}
        <CardContent>
          <pre className="max-h-80 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
            {exported.body}
          </pre>
        </CardContent>
      </Card>

      {exported.rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Payer</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exported.rows.slice(0, 50).map((row, index) => (
              <TableRow key={`${row.visitId}-${index}`}>
                <TableCell>{row.patientName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.payerName ?? '—'}
                  {row.payerRef ? ` · ${row.payerRef}` : ''}
                </TableCell>
                <TableCell className="tabular">{row.billCode ?? '—'}</TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell className="text-right tabular">{row.amount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </>
  )
}
