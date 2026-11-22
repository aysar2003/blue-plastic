import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { db } from '@/server/db'
import { requireOrgContext } from '@/server/auth/context'
import { ensureEducationBootstrap } from '@/server/services/education-bootstrap.service'
import * as education from '@/server/services/education.service'
import * as sis from '@/server/services/school-sis.service'

export const metadata: Metadata = { title: 'Education' }

export default async function EducationHubPage() {
  const ctx = await requireOrgContext('invoice:read')
  await db.$transaction((tx) =>
    ensureEducationBootstrap(tx, ctx.orgId, ctx.organization.installedPackId),
  )
  const [stats, outstanding, classes] = await Promise.all([
    education.hubStats(ctx),
    education.feesOutstandingByTerm(ctx),
    sis.listClasses(ctx),
  ])
  const outstandingTotal = outstanding.reduce((sum, row) => sum + Number(row.outstanding), 0)
  const isUniversity = ctx.organization.installedPackId === 'university'

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader
        title={isUniversity ? 'University management' : 'School management'}
        description={
          isUniversity
            ? 'Tuition & ledger, programs, classes, attendance, grades, and portal report cards.'
            : 'Full school desk: fees & ledger, classroom SIS, timetable, assignments, transport, hostel, announcements, and discipline.'
        }
      />

      {stats.programs === 0 ? (
        <Card className="border-foreground/20">
          <CardHeader>
            <CardTitle className="text-base">Next step</CardTitle>
            <CardDescription>
              Review the school year, programs and terms, then fee plans and enrollments. Closed
              years stay on file forever.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/education/years" className="text-sm font-medium underline underline-offset-4">
              Open school year
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Snapshot</CardTitle>
          <CardDescription>
            {stats.programs} programs · {stats.terms} terms · {stats.activeEnrollments} active
            enrollments · {classes.length} classes
            {outstanding.length > 0
              ? ` · ${outstanding.length} term${outstanding.length === 1 ? '' : 's'} with open fees`
              : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fees & billing
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/education/years" className="underline underline-offset-4">
                School years
              </Link>
              <Link href="/education/programs" className="underline underline-offset-4">
                Programs
              </Link>
              <Link href="/education/terms" className="underline underline-offset-4">
                Terms
              </Link>
              <Link href="/education/fees" className="underline underline-offset-4">
                Fee plans
              </Link>
              <Link href="/education/enrollments" className="underline underline-offset-4">
                Enrollments
              </Link>
              <Link href="/education/fees-outstanding" className="underline underline-offset-4">
                Fees outstanding
              </Link>
              <Link href="/education/import" className="underline underline-offset-4">
                Import students
              </Link>
              <Link href="/customers" className="underline underline-offset-4">
                Students (customers)
              </Link>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Classroom SIS
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/education/classes" className="underline underline-offset-4">
                Classes & roster
              </Link>
              <Link href="/education/attendance" className="underline underline-offset-4">
                Attendance
              </Link>
              <Link href="/education/grades" className="underline underline-offset-4">
                Grades
              </Link>
              <Link href="/education/subjects" className="underline underline-offset-4">
                Subjects
              </Link>
              <Link href="/education/timetable" className="underline underline-offset-4">
                Timetable
              </Link>
              <Link href="/education/assignments" className="underline underline-offset-4">
                Assignments
              </Link>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Campus ops
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/education/transport" className="underline underline-offset-4">
                Transport
              </Link>
              <Link href="/education/hostel" className="underline underline-offset-4">
                Hostel
              </Link>
              <Link href="/education/announcements" className="underline underline-offset-4">
                Announcements
              </Link>
              <Link href="/education/discipline" className="underline underline-offset-4">
                Discipline
              </Link>
            </div>
          </div>

          {outstanding.length > 0 ? (
            <p className="text-muted-foreground">
              Open fee balance across terms:{' '}
              <span className="font-medium text-foreground tabular-nums">
                {outstandingTotal.toFixed(2)}
              </span>{' '}
              {ctx.organization.baseCurrency}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
