import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { requirePortalContext } from '@/server/auth/context'
import * as ops from '@/server/services/school-ops.service'

export const metadata: Metadata = { title: 'School' }

export default async function PortalSchoolPage() {
  const ctx = await requirePortalContext()
  const home = await ops.portalSchoolHome(ctx, ctx.portalCustomerId)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">School</h1>
          <p className="text-sm text-muted-foreground">
            Assignments, announcements, transport, and hostel for this account.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/portal/report-cards" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Report cards
          </Link>
          <Link href="/portal" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Portal home
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Announcements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {home.announcements.length === 0 ? (
            <p className="text-muted-foreground">No announcements yet.</p>
          ) : (
            home.announcements.map((row) => (
              <div key={row.id} className="border-b border-border pb-3 last:border-0">
                <p className="font-medium">{row.title}</p>
                <p className="text-xs text-muted-foreground">
                  {row.publishedOn.toISOString().slice(0, 10)} · {row.audience}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{row.body}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assignments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {home.assignments.length === 0 ? (
            <p className="text-muted-foreground">No assignments linked yet.</p>
          ) : (
            home.assignments.map((row) => (
              <div key={row.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-2 last:border-0">
                <div>
                  <p className="font-medium">{row.assignment.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.assignment.schoolClass.name}
                    {row.assignment.subject ? ` · ${row.assignment.subject.name}` : ''}
                  </p>
                </div>
                <p className="text-xs font-medium">{row.status}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transport</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {home.transport.length === 0 ? (
              <p className="text-muted-foreground">No transport route assigned.</p>
            ) : (
              home.transport.map((row) => (
                <p key={row.id}>
                  {row.route.name}
                  {row.stopName ? ` · stop ${row.stopName}` : ''}
                </p>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hostel</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {home.hostel.length === 0 ? (
              <p className="text-muted-foreground">No hostel bed allocated.</p>
            ) : (
              home.hostel.map((row) => (
                <p key={row.id}>
                  {row.room.block.name} / {row.room.name}
                  {row.bedLabel ? ` · bed ${row.bedLabel}` : ''}
                </p>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
