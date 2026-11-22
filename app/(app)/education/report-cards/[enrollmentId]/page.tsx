import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as sis from '@/server/services/school-sis.service'

export const metadata: Metadata = { title: 'Report card' }

export default async function EducationReportCardPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const { enrollmentId } = await params
  let card
  try {
    card = await sis.studentReportCard(ctx, enrollmentId)
  } catch {
    notFound()
  }

  return (
    <>
      <PageHeader
        title={`Report card · ${card.enrollment.studentName}`}
        description={`${card.enrollment.programName} · ${card.enrollment.termName}`}
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Present</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {card.attendance.present}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Absent</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {card.attendance.absent}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Late / excused</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {card.attendance.late + card.attendance.excused}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attendance rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {card.attendance.rate == null ? '—' : `${card.attendance.rate}%`}
          </CardContent>
        </Card>
      </div>

      {card.classes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Student is not on any class roster yet.</p>
      ) : (
        <div className="space-y-6">
          {card.classes.map((block) => (
            <Card key={block.classId}>
              <CardHeader>
                <CardTitle className="text-base">
                  {block.className}
                  {block.teacherName ? (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      · {block.teacherName}
                    </span>
                  ) : null}
                  <span className="ml-3 text-sm font-semibold tabular-nums">
                    {block.averagePercent == null
                      ? '—'
                      : `${block.averagePercent.toFixed(2)}% (${block.letter})`}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {block.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No scores yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Assessment</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">Max</TableHead>
                        <TableHead className="text-right">Weight %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {block.rows.map((row) => (
                        <TableRow key={row.name}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.score}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.maxScore}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.weightPercent}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
