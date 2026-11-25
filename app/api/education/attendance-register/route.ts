import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import * as sis from '@/server/services/school-sis.service'

export async function GET(request: Request) {
  const ctx = await requireOrgContext('invoice:read')
  const url = new URL(request.url)
  const classId = url.searchParams.get('classId') ?? ''
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? from
  if (!classId || !from || !to) {
    return new NextResponse('Missing classId, from, or to', { status: 400 })
  }

  const register = await sis.attendanceRegister(ctx, classId, from, to)
  const header = [
    'Student',
    ...register.dates,
    'Present',
    'Absent',
    'Late',
    'Excused',
  ]
  const lines = [header.join(',')]
  for (const row of register.rows) {
    const cells = [
      JSON.stringify(row.studentName),
      ...row.marks.map((m) => m.mark ?? ''),
      String(row.summary.present),
      String(row.summary.absent),
      String(row.summary.late),
      String(row.summary.excused),
    ]
    lines.push(cells.join(','))
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendance-${from}-${to}.csv"`,
    },
  })
}