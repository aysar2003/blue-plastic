import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'
import * as statutoryExport from '@/server/services/statutory-export.service'

export const metadata: Metadata = { title: 'Payroll statutory export' }

export default async function PayrollStatutoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const ctx = await requireOrgContext('hr:payroll')
  const query = await searchParams
  const year = new Date().getFullYear()
  const from = query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? query.from : `${year}-01-01`
  const to = query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to) ? query.to : `${year}-12-31`
  const { rows } = await statutoryExport.payrollStatutoryExport(ctx, { from, to })

  return (
    <>
      <PageHeader
        title="Payroll statutory export"
        description={`Posted payslips ${from} → ${to} as Excel or JSON for filing.`}
        actions={
          <>
            <Link
              href={`/api/employees/payroll/statutory?from=${from}&to=${to}`}
              className={buttonVariants({ size: 'sm' })}
            >
              Download Excel
            </Link>
            <Link
              href={`/api/employees/payroll/statutory?from=${from}&to=${to}&format=json`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Download JSON
            </Link>
          </>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3" action="/employees/payroll/statutory">
        <label className="grid gap-1 text-sm">
          From
          <input
            className="h-9 rounded-md border border-input bg-transparent px-3"
            type="date"
            name="from"
            defaultValue={from}
          />
        </label>
        <label className="grid gap-1 text-sm">
          To
          <input
            className="h-9 rounded-md border border-input bg-transparent px-3"
            type="date"
            name="to"
            defaultValue={to}
          />
        </label>
        <button className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground" type="submit">
          Show
        </button>
      </form>

      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          {rows.length === 0
            ? 'No posted payslips in this range.'
            : `${rows.length} payslip${rows.length === 1 ? '' : 's'} ready to export.`}
        </CardContent>
      </Card>
    </>
  )
}
