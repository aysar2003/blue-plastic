import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import { myPayslips } from '@/server/services/payroll-standard.service'

export const metadata: Metadata = { title: 'My payslips' }

export default async function MyPayslipsPage() {
  const ctx = await requireOrgContext()
  const mine = await myPayslips(ctx)

  return (
    <>
      <PageHeader
        title="My payslips"
        description={
          mine.employeeName
            ? `Payslips for ${mine.employeeName}. Link a login on the employee card if this is the wrong person.`
            : 'No employee card is linked to your login. Open the employee and set the user.'
        }
      />
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Number</th>
              <th className="px-3 py-2 font-medium">Period</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Net</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {mine.slips.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No payslips yet.
                </td>
              </tr>
            ) : (
              mine.slips.map((slip) => (
                <tr key={slip.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{slip.number ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/employees/payroll/mine/${slip.id}`}
                      className="text-primary hover:underline"
                    >
                      {slip.periodStart} → {slip.periodEnd}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{slip.status}</td>
                  <td className="px-3 py-2">{slip.net}</td>
                  <td className="px-3 py-2 text-right">
                    <a
                      className="text-primary hover:underline"
                      href={`/api/payroll/payslips/${slip.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      PDF
                    </a>
                    <a
                      className="ml-2 text-primary hover:underline"
                      href={`/api/payroll/payslips/${slip.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Print
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
