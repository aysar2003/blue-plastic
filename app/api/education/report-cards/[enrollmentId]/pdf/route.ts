import { renderReportCardPdf } from '@/server/reports/report-card-pdf'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as sis from '@/server/services/school-sis.service'

export async function GET(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string }> },
) {
  const ctx = await requireOrgContext('invoice:read')
  const { enrollmentId } = await context.params
  let card
  try {
    card = await sis.studentReportCard(ctx, enrollmentId)
  } catch (error) {
    if (isAppError(error) && error.code === 'NOT_FOUND') {
      return new Response('Not found', { status: 404 })
    }
    throw error
  }

  const overallValues = card.classes
    .map((c) => c.averagePercent)
    .filter((v): v is number => v != null && Number.isFinite(v))
  const overall =
    overallValues.length > 0
      ? Math.round((overallValues.reduce((a, b) => a + b, 0) / overallValues.length) * 100) / 100
      : null
  const primaryRank = card.classes[0]?.classRank ?? null

  const bytes = renderReportCardPdf({
    orgName: ctx.organization.name,
    studentName: card.enrollment.studentName,
    admissionNumber: card.enrollment.admissionNumber ?? null,
    programName: card.enrollment.programName,
    termName: card.enrollment.termName,
    overallAverage: overall == null ? '—' : `${overall.toFixed(2)}%`,
    overallHorn: card.classes[0]?.letter ?? '—',
    classRank: primaryRank == null ? null : String(primaryRank),
    attendanceRate: card.attendance.rate == null ? '—' : `${card.attendance.rate}%`,
    classes: card.classes.map((block) => ({
      className: block.className,
      teacherName: block.teacherName,
      average: block.averagePercent == null ? '—' : `${block.averagePercent.toFixed(2)}%`,
      horn: block.letter,
      rank: block.classRank == null ? null : `${block.classRank}/${block.classSize}`,
      subjects: (block.subjects ?? []).map((subject) => ({
        subjectName: subject.subjectName,
        average:
          subject.averagePercent == null ? '—' : `${subject.averagePercent.toFixed(2)}%`,
        horn: subject.letter,
        rows: subject.rows.map((row) => ({
          name: row.name,
          score: String(row.score),
          max: String(row.maxScore),
        })),
      })),
    })),
  })

  const filename = `report-card-${card.enrollment.studentName.replace(/[^\w.-]+/g, '_')}.pdf`
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
