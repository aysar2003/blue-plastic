import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as hospital from '@/server/services/hospital.service'

export const metadata: Metadata = { title: 'Hospital billing' }

export default async function HospitalHubPage() {
  const ctx = await requireOrgContext('invoice:read')
  const [stats, patientAr, byDept] = await Promise.all([
    hospital.hubStats(ctx),
    hospital.patientArSummary(ctx),
    hospital.servicesByDepartment(ctx),
  ])
  const currency = ctx.organization.baseCurrency

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader
        title="Hospital billing"
        description="Patient visits, service charges, and AR invoices. This is not a clinical EMR or chart."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Snapshot</CardTitle>
          <CardDescription>
            {stats.open} open visits · {stats.closed} closed (invoiced)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <Link href="/hospital/visits" className="underline underline-offset-4">
            Visits & charges
          </Link>
          <Link href="/hospital/claims" className="underline underline-offset-4">
            Claims export
          </Link>
          <Link href="/customers" className="underline underline-offset-4">
            Patients (customers)
          </Link>
          <Link href="/items" className="underline underline-offset-4">
            Service items
          </Link>
          <Link href="/settings/classes" className="underline underline-offset-4">
            Departments (classes)
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patient AR</CardTitle>
          <CardDescription>Closed visits with open invoice balances.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {patientAr.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState
                title="No patient balances"
                description="Close a visit to an invoice, then unpaid balances appear here."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Dept</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patientAr.map((row) => (
                  <TableRow key={row.visitId}>
                    <TableCell className="font-medium">{row.patientName}</TableCell>
                    <TableCell>{row.department ?? '—'}</TableCell>
                    <TableCell>{row.invoiceNumber ?? '—'}</TableCell>
                    <TableCell className="text-right tabular">
                      {formatMoney(row.outstanding, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Services by department</CardTitle>
          <CardDescription>Closed visit charges rolled up by class / department.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {byDept.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState
                title="No department totals yet"
                description="Tag visits with a department class when charging services."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Charges</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byDept.map((row) => (
                  <TableRow key={row.departmentId ?? row.department}>
                    <TableCell className="font-medium">{row.department}</TableCell>
                    <TableCell className="text-right tabular">{row.chargeCount}</TableCell>
                    <TableCell className="text-right tabular">
                      {formatMoney(row.amount, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
