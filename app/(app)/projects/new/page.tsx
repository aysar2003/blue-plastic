import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import { ProjectForm } from '../project-form'

export const metadata: Metadata = { title: 'New project' }

export default async function NewProjectPage() {
  const ctx = await requireOrgContext('project:create')
  const [documentNumber, customers] = await Promise.all([
    peekDocumentNumber(db, ctx.orgId, 'PROJECT'),
    db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 5000,
    }),
  ])

  return (
    <>
      <PageHeader
        title="New project"
        description="Open a job folder for a customer site, then add estimates and convert them when the work is confirmed."
        className="mb-4"
      />
      <ProjectForm
        customers={customers.map((row) => ({ id: row.id, label: row.displayName }))}
        documentNumber={documentNumber}
        initial={{
          number: '',
          name: '',
          customerId: '',
          siteLocation: '',
          description: '',
          status: 'DRAFT',
          startDate: today(ctx.organization.timeZone),
          endDate: '',
        }}
      />
    </>
  )
}
