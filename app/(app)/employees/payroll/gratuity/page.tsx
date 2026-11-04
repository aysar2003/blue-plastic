import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import * as payrollService from '@/server/services/payroll.service'
import * as standardPayroll from '@/server/services/payroll-standard.service'
import { GratuityBoard } from './gratuity-board'

export const metadata: Metadata = { title: 'End of service' }

export default async function GratuityPage() {
  const ctx = await requireOrgContext('hr:payroll')
  const [rows, people, accounts] = await Promise.all([
    standardPayroll.listEndOfService(ctx),
    standardPayroll.listPeople(ctx),
    payrollService.listPayAccounts(ctx),
  ])
  return (
    <>
      <PageHeader title="End of service" description="Gratuity from hire date to the date you choose." />
      <GratuityBoard rows={rows} people={people} accounts={accounts} canManage={ctx.permissions.has('hr:payroll')} />
    </>
  )
}
