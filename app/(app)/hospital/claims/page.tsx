import type { Metadata } from 'next'
import Link from 'next/link'

import {
  applyClaimRemittanceAction,
  stampClaimsExportAction,
  submitClaimAction,
} from '@/app/(app)/hospital/actions'
import { PageHeader } from '@/components/data/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as hospital from '@/server/services/hospital.service'
import { selectableAccounts } from '@/server/services/account.service'

export const metadata: Metadata = { title: 'Claims export' }

export default async function HospitalClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; includeExported?: string; payer?: string; batch?: string }>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const query = await searchParams
  const format = query.format === 'csv' ? 'csv' : 'json'
  const includeExported = query.includeExported === '1'
  const payerName = query.payer ?? ''
  const exportBatchId = query.batch ?? ''
  const canStamp = ctx.permissions.has('invoice:create')
  const canPay = ctx.permissions.has('payment:create')
  const [exported, claimVisits, accounts] = await Promise.all([
    hospital.exportClaims(ctx, {
    format,
    status: 'CLOSED',
    includeExported,
    payerName: payerName || undefined,
    exportBatchId: exportBatchId || undefined,
    stamp: false,
    }),
    hospital.listClaimVisits(ctx),
    selectableAccounts(ctx, { withBalances: false }),
  ])
  const banks = accounts.filter(
    (account) => account.subtype === 'BANK' || account.subtype === 'UNDEPOSITED_FUNDS',
  )

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
              href={`/hospital/claims?format=${format}&includeExported=1${payerName ? `&payer=${encodeURIComponent(payerName)}` : ''}`}
              className={buttonVariants({ variant: includeExported ? 'default' : 'outline', size: 'sm' })}
            >
              Include already exported
            </Link>
          </div>
        }
      />

      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input type="hidden" name="format" value={format} />
        {includeExported ? <input type="hidden" name="includeExported" value="1" /> : null}
        <input
          name="payer"
          defaultValue={payerName}
          placeholder="Filter payer"
          className="h-9 rounded-md border px-2 text-sm"
        />
        <input
          name="batch"
          defaultValue={exportBatchId}
          placeholder="Export batch id"
          className="h-9 rounded-md border px-2 text-sm"
        />
        <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          Apply filters
        </button>
      </form>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Download payload</CardTitle>
          <CardDescription>
            {exported.rows.length} charge line{exported.rows.length === 1 ? '' : 's'} · format{' '}
            {exported.format.toUpperCase()}
            {includeExported ? ' · including previously stamped' : ' · unexported only'}
            {exported.exportBatchId ? ` · batch ${exported.exportBatchId}` : ''}
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

      {claimVisits.length > 0 ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Claim status & remittance</CardTitle>
            <CardDescription>
              Submitted / paid / denied. A paid remittance posts a customer payment against the visit
              invoice. Not an EMR.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimVisits.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell>{visit.customer.displayName}</TableCell>
                    <TableCell>
                      {visit.salesDocument ? (
                        <Link
                          href={`/sales/invoices/${visit.salesDocument.id}`}
                          className="underline underline-offset-4"
                        >
                          {visit.salesDocument.number}
                        </Link>
                      ) : (
                        '—'
                      )}
                      {visit.remittancePayment ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {visit.remittancePayment.number}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{visit.claimStatus}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canStamp && (visit.claimStatus === 'OPEN' || visit.claimStatus === 'DENIED') ? (
                          <form action={submitClaimAction}>
                            <input type="hidden" name="visitId" value={visit.id} />
                            <Button type="submit" size="sm" variant="outline">
                              Submit
                            </Button>
                          </form>
                        ) : null}
                        {canPay &&
                        (visit.claimStatus === 'SUBMITTED' || visit.claimStatus === 'OPEN') &&
                        banks[0] ? (
                          <form action={applyClaimRemittanceAction} className="inline-flex flex-wrap items-center gap-1">
                            <input type="hidden" name="visitId" value={visit.id} />
                            <Input name="note" placeholder="Remittance note" className="h-8 w-36 text-xs" />
                            <NativeSelect
                              name="depositAccountId"
                              className="h-8 text-xs"
                              defaultValue={banks[0].id}
                            >
                              {banks.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.code}
                                </option>
                              ))}
                            </NativeSelect>
                            <button
                              type="submit"
                              name="status"
                              value="PAID"
                              className={buttonVariants({ size: 'sm' })}
                            >
                              Paid
                            </button>
                            <button
                              type="submit"
                              name="status"
                              value="DENIED"
                              className={buttonVariants({ size: 'sm', variant: 'outline' })}
                            >
                              Denied
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
