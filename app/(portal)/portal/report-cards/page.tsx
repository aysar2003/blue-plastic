import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requirePortalContext } from '@/server/auth/context'
import * as sis from '@/server/services/school-sis.service'

export const metadata: Metadata = { title: 'Report cards' }

export default async function PortalReportCardsPage() {
  const ctx = await requirePortalContext()
  const customerId = ctx.portalCustomerId
  if (!customerId) {
    return (
      <p className="text-sm text-muted-foreground">
        No student account is linked to this portal login.
      </p>
    )
  }

  const cards = await sis.portalReportCardsForCustomer(ctx, customerId)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Report cards</h1>
          <p className="text-sm text-muted-foreground">
            Grades and attendance for enrollments on this account.
          </p>
        </div>
        <Link href="/portal" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Portal home
        </Link>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No school enrollments for this account yet.</p>
      ) : (
        cards.map((card) => (
          <Card key={card.enrollment.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {card.enrollment.studentName} · {card.enrollment.programName} ·{' '}
                {card.enrollment.termName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Attendance: {card.attendance.present} present · {card.attendance.absent} absent ·{' '}
                {card.attendance.rate == null ? '—' : `${card.attendance.rate}%`} rate
              </p>
              {card.classes.map((block) => (
                <div key={block.classId} className="space-y-2">
                  <p className="font-medium">
                    {block.className}{' '}
                    <span className="tabular-nums text-muted-foreground">
                      {block.averagePercent == null
                        ? '—'
                        : `${block.averagePercent.toFixed(2)}% (${block.letter})`}
                    </span>
                  </p>
                  {block.rows.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Assessment</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                          <TableHead className="text-right">Max</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {block.rows.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.score}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.maxScore}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground">No scores posted yet.</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
