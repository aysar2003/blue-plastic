import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/server/auth/context'
import * as payrollService from '@/server/services/payroll.service'
import { PayrollDetail } from './payroll-detail'

export const metadata: Metadata = { title: 'Payroll run' }

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext('hr:payroll')
  const { id } = await params
  const [run, accounts] = await Promise.all([
    payrollService.getRun(ctx, id).catch(() => null),
    payrollService.listPayAccounts(ctx),
  ])
  if (!run) notFound()

  return (
    <>
      <PageHeader
        title={`Payroll ${run.periodStart} – ${run.periodEnd}`}
        description={run.status === 'POSTED' ? 'Posted to the ledger' : 'Draft — review and post'}
        actions={
          <Button asChild type="button" size="sm" variant="outline">
            <Link href="/employees/payroll">Back to runs</Link>
          </Button>
        }
      />
      <PayrollDetail
        run={run}
        accounts={accounts}
        canManage={ctx.permissions.has('hr:payroll')}
      />
    </>
  )
}
