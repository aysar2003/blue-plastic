import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import { payrollReport } from '@/server/services/payroll-standard.service'

export const metadata: Metadata = { title: 'Payroll report' }

export default async function PayrollReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const ctx = await requireOrgContext('hr:payroll')
  const query = await searchParams
  const year = new Date().getFullYear()
  const from = query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? query.from : `${year}-01-01`
  const to = query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to) ? query.to : `${year}-12-31`
  const rows = await payrollReport(ctx, from, to)

  return (
    <>
      <PageHeader title="Payroll report" description={`Posted payslips from ${from} to ${to}, by department.`} />
      <form className="mb-4 flex flex-wrap items-end gap-3" action="/employees/payroll/report">
        <label className="grid gap-1 text-sm">
          From
          <input className="h-9 rounded-md border border-input bg-transparent px-3" type="date" name="from" defaultValue={from} />
        </label>
        <label className="grid gap-1 text-sm">
          To
          <input className="h-9 rounded-md border border-input bg-transparent px-3" type="date" name="to" defaultValue={to} />
        </label>
        <button className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground" type="submit">
          Show
        </button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Department</th>
              <th className="px-3 py-2 font-medium">Payslips</th>
              <th className="px-3 py-2 font-medium">Gross</th>
              <th className="px-3 py-2 font-medium">Deductions</th>
              <th className="px-3 py-2 font-medium">Employer</th>
              <th className="px-3 py-2 font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No posted payroll in this range.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.department} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2">{row.people}</td>
                  <td className="px-3 py-2">{row.gross}</td>
                  <td className="px-3 py-2">{row.deductions}</td>
                  <td className="px-3 py-2">{row.employer}</td>
                  <td className="px-3 py-2 font-medium">{row.net}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
