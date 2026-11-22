import type { Metadata } from 'next'
import Link from 'next/link'

import { createAnnouncementAction } from '@/app/(app)/education/ops-actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SCHOOL_AUDIENCES } from '@/lib/erp/school-ops'
import { requireOrgContext } from '@/server/auth/context'
import * as ops from '@/server/services/school-ops.service'

export const metadata: Metadata = { title: 'Announcements' }

export default async function EducationAnnouncementsPage() {
  const ctx = await requireOrgContext('invoice:read')
  const rows = await ops.listAnnouncements(ctx)

  return (
    <>
      <PageHeader
        title="Announcements"
        description="School notices for staff, parents, and students."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />
      <Card className="mb-6">
        <CardContent className="space-y-3 p-4">
          <form action={createAnnouncementAction} className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">
                Title
                <Input name="title" required className="mt-1 w-72" />
              </label>
              <label className="text-sm">
                Audience
                <select
                  name="audience"
                  defaultValue="ALL"
                  className="mt-1 block h-9 w-40 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {SCHOOL_AUDIENCES.map((audience) => (
                    <option key={audience} value={audience}>
                      {audience}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Date
                <Input name="publishedOn" type="date" className="mt-1 w-40" />
              </label>
            </div>
            <label className="block text-sm">
              Body
              <textarea
                name="body"
                required
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Publish
            </button>
          </form>
        </CardContent>
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="No announcements" description="Publish the first school notice." />
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{row.title}</h3>
                <span className="text-xs text-muted-foreground">
                  {row.audience} · {row.publishedOn.toISOString().slice(0, 10)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{row.body}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
