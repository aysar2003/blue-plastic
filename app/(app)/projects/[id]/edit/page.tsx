import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as projectService from '@/server/services/project.service'
import { ProjectForm } from '../../project-form'

export const metadata: Metadata = { title: 'Edit project' }

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireOrgContext('project:update')
  const [project, customers] = await Promise.all([
    projectService.get(ctx, id).catch(() => null),
    db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 5000,
    }),
  ])
  if (!project) notFound()

  return (
    <>
      <PageHeader
        title={`Edit ${project.number}`}
        description={project.name}
        className="mb-4"
      />
      <ProjectForm
        customers={customers.map((row) => ({ id: row.id, label: row.displayName }))}
        documentNumber={project.number}
        initial={{
          id: project.id,
          number: project.number,
          name: project.name,
          customerId: project.customer.id,
          siteLocation: project.siteLocation ?? '',
          description: project.description ?? '',
          status: project.status,
          startDate: project.startDate ?? '',
          endDate: project.endDate ?? '',
        }}
      />
    </>
  )
}
