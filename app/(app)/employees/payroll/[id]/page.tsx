import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/server/auth/context'
import * as payrollService from '@/server/services/payroll.service'
import * as standardPayroll from '@/server/services/payroll-standard.service'
import { PayrollDetail } from './payroll-detail'

export const metadata: Metadata = { title: 'Payroll run' }

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext('hr:payroll')
  const { id } = await params
  const [run, accounts, people] = await Promise.all([
    payrollService.getRun(ctx, id).catch(() => null),
    payrollService.listPayAccounts(ctx),
    ctx.features.payrollStandard ? standardPayroll.listPeople(ctx) : Promise.resolve([]),
  ])
  if (!run) notFound()
  const onRun = new Set(run.payslips.map((slip) => slip.employeeId))
  const addablePeople = people.filter((person) => !onRun.has(person.id))

  return (
    <>
      <PageHeader
        title={`Payroll ${run.periodStart} – ${run.periodEnd}`}
        description={
          run.status === 'POSTED'
            ? 'Posted to the ledger'
            : run.awaitingApproval
              ? 'Waiting for approval'
              : 'Draft — review, then submit'
        }
        actions={
          <Button asChild type="button" size="sm" variant="outline">
            <Link href="/employees/payroll">Back to runs</Link>
          </Button>
        }
      />
      <PayrollDetail
        run={run}
        accounts={accounts}
        addablePeople={addablePeople}
        canManage={ctx.permissions.has('hr:payroll')}
        standard={ctx.features.payrollStandard}
      />
    </>
  )
}
