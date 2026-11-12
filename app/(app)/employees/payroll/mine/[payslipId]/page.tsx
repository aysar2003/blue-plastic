import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/server/auth/context'
import { myPayslipDetail } from '@/server/services/payroll-standard.service'

export const metadata: Metadata = { title: 'My payslip' }

export default async function MyPayslipDetailPage({
  params,
}: {
  params: Promise<{ payslipId: string }>
}) {
  const ctx = await requireOrgContext()
  const { payslipId } = await params
  const slip = await myPayslipDetail(ctx, payslipId).catch(() => null)
  if (!slip) notFound()

  return (
    <>
      <PageHeader
        title={slip.number ?? 'Payslip'}
        description={`${slip.periodStart} → ${slip.periodEnd} · ${slip.status}`}
        actions={
          <div className="flex gap-2">
            <Button asChild type="button" size="sm" variant="outline">
              <Link href="/employees/payroll/mine">Back</Link>
            </Button>
            <Button asChild type="button" size="sm" variant="outline">
              <a href={`/api/payroll/payslips/${slip.id}/pdf`} target="_blank" rel="noreferrer">
                PDF
              </a>
            </Button>
            <Button asChild type="button" size="sm">
              <a href={`/api/payroll/payslips/${slip.id}/pdf`} target="_blank" rel="noreferrer">
                Print
              </a>
            </Button>
          </div>
        }
      />
      <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gross" value={slip.gross} />
        <Stat label="Deductions" value={slip.deductions} />
        <Stat label="Net" value={slip.net} />
        <Stat label="YTD net" value={slip.ytdNet} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Line</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {slip.lines.map((line) => (
              <tr key={line.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{line.label}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {line.affectsNet ? line.kind : 'Employer'}
                </td>
                <td className="px-3 py-2 text-right">{line.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{Number(value).toFixed(2)}</p>
    </div>
  )
}
