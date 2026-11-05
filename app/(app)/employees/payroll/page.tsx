import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { requireOrgContext } from '@/server/auth/context'
import * as payrollService from '@/server/services/payroll.service'
import * as standardPayroll from '@/server/services/payroll-standard.service'
import { PayrollBoard } from './payroll-board'

export const metadata: Metadata = { title: 'Payroll' }

export default async function PayrollPage() {
  const ctx = await requireOrgContext('hr:payroll')
  if (ctx.features.payrollStandard) await standardPayroll.ensureStandardStructure(ctx)
  const [runs, accounts, people] = await Promise.all([
    payrollService.listRuns(ctx),
    payrollService.listPayAccounts(ctx),
    ctx.features.payrollStandard ? standardPayroll.listPeople(ctx) : Promise.resolve([]),
  ])

  return (
    <>
      <PageHeader
        title="Payroll"
        description={
          ctx.features.payrollStandard
            ? 'Standard payroll is on. Gross wages, liabilities, then approve and post.'
            : 'Draft payslips from wages, then post to the ledger.'
        }
        actions={
          <>
            <Link
              href="/employees/payroll/report"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Report
            </Link>
            <Link
              href="/employees/payroll/statutory"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Statutory export
            </Link>
          </>
        }
      />
      <PayrollBoard
        runs={runs}
        accounts={accounts}
        people={people}
        standard={ctx.features.payrollStandard}
        canManage={ctx.permissions.has('hr:payroll')}
      />
    </>
  )
}
