import { buildTextPdf, PDF_PAGE, type PdfRow } from '@/lib/pdf-text'

export function renderReportCardPdf(input: {
  orgName: string
  studentName: string
  admissionNumber: string | null
  programName: string
  termName: string
  overallAverage: string
  overallHorn: string
  classRank: string | null
  attendanceRate: string
  classes: {
    className: string
    teacherName: string | null
    average: string
    horn: string
    rank: string | null
    subjects: {
      subjectName: string
      average: string
      horn: string
      rows: { name: string; score: string; max: string }[]
    }[]
  }[]
}): Uint8Array {
  const rows: PdfRow[] = [
    { size: 16, runs: [{ text: input.orgName, bold: true }] },
    { size: 12, runs: [{ text: 'Student report card', bold: true }] },
    {
      runs: [
        { text: input.studentName, bold: true },
        {
          text: input.admissionNumber ? ` · Adm ${input.admissionNumber}` : '',
        },
      ],
    },
    {
      runs: [{ text: `${input.programName} · ${input.termName}` }],
      rule: true,
    },
    {
      runs: [
        { text: `Overall ${input.overallAverage} (${input.overallHorn})` },
        {
          text: input.classRank ? ` · Rank ${input.classRank}` : '',
        },
      ],
    },
    { runs: [{ text: `Attendance ${input.attendanceRate}` }], rule: true },
  ]

  for (const block of input.classes) {
    rows.push({
      runs: [
        {
          text: `${block.className}${block.teacherName ? ` · ${block.teacherName}` : ''}`,
          bold: true,
        },
      ],
    })
    rows.push({
      runs: [
        { text: `${block.average} (${block.horn})` },
        { text: block.rank ? ` · Rank ${block.rank}` : '' },
      ],
    })
    for (const subject of block.subjects) {
      rows.push({
        runs: [
          { text: `  ${subject.subjectName}`, bold: true },
          {
            text: `${subject.average} ${subject.horn}`,
            align: 'right',
            x: PDF_PAGE.right,
          },
        ],
      })
      for (const row of subject.rows) {
        rows.push({
          runs: [
            { text: `    ${row.name}` },
            {
              text: `${row.score} / ${row.max}`,
              align: 'right',
              x: PDF_PAGE.right,
            },
          ],
        })
      }
    }
    rows.push({ runs: [{ text: '' }], rule: true })
  }

  return buildTextPdf(rows)
}
