import type { Metadata } from 'next'
import Link from 'next/link'

import { AppLauncher } from '@/components/layout/app-launcher'
import { projectAppsForPermissions } from '@/components/layout/project-apps'
import { Card } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export const metadata: Metadata = { title: 'Projects' }

export default async function ProjectsHubPage() {
  const ctx = await requireOrgContext('project:read')
  const apps = projectAppsForPermissions(ctx.permissions)

  const [active, drafts, done] = await Promise.all([
    db.project.count({ where: { orgId: ctx.orgId, status: 'ACTIVE' } }),
    db.project.count({ where: { orgId: ctx.orgId, status: 'DRAFT' } }),
    db.project.count({ where: { orgId: ctx.orgId, status: 'DONE' } }),
  ])

  return (
    <>
      <AppLauncher
        eyebrow={ctx.organization.name}
        title="Projects"
        subtitle="Prepare a customer job, attach estimates and orders, then convert to invoices — the same path Sales already uses."
        apps={apps}
        insights={[
          {
            label: 'Active jobs',
            value: String(active),
            hint: active === 1 ? 'in progress' : 'in progress',
            href: '/projects/list?status=ACTIVE',
          },
          {
            label: 'Drafts',
            value: String(drafts),
            hint: 'not started yet',
            href: '/projects/list?status=DRAFT',
          },
          {
            label: 'Completed',
            value: String(done),
            hint: 'done',
            href: '/projects/list?status=DONE',
          },
        ]}
      />

      <Card className="mt-6 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How it works</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            <Link href="/projects/new" className="text-primary underline-offset-2 hover:underline">
              Create a project
            </Link>{' '}
            for the customer and site.
          </li>
          <li>Add an estimate (or quotation / sales order) from the job folder.</li>
          <li>Convert the estimate to an order or invoice — same conversion Sales already uses.</li>
        </ol>
      </Card>
    </>
  )
}
