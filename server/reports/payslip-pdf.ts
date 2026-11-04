import { buildTextPdf, PDF_PAGE, type PdfRow } from '@/lib/pdf-text'

export function renderPayslipPdf(input: {
  orgName: string
  number: string
  employeeName: string
  department: string | null
  periodStart: string
  periodEnd: string
  gross: string
  deductions: string
  employer: string
  net: string
  ytdGross: string
  ytdNet: string
  lines: { label: string; amount: string; kind: string; affectsNet: boolean }[]
}): Uint8Array {
  const rows: PdfRow[] = [
    { size: 16, runs: [{ text: input.orgName, bold: true }] },
    { size: 11, runs: [{ text: `Payslip ${input.number}` }] },
    {
      runs: [
        { text: input.employeeName, bold: true },
        { text: input.department ? ` · ${input.department}` : '' },
      ],
    },
    { runs: [{ text: `${input.periodStart} – ${input.periodEnd}` }], rule: true },
  ]
  for (const line of input.lines) {
    const sign = !line.affectsNet ? ' ' : line.kind === 'DEDUCTION' ? '−' : '+'
    rows.push({
      runs: [
        { text: `${sign} ${line.label}` },
        { text: Number(line.amount).toFixed(2), align: 'right', x: PDF_PAGE.right },
      ],
    })
  }
  rows.push({
    rule: true,
    runs: [
      { text: 'Gross', bold: true },
      { text: input.gross, align: 'right', x: PDF_PAGE.right, bold: true },
    ],
  })
  rows.push({
    runs: [
      { text: 'Deductions' },
      { text: input.deductions, align: 'right', x: PDF_PAGE.right },
    ],
  })
  rows.push({
    runs: [
      { text: 'Employer cost' },
      { text: input.employer, align: 'right', x: PDF_PAGE.right },
    ],
  })
  rows.push({
    runs: [
      { text: 'Net pay', bold: true },
      { text: input.net, align: 'right', x: PDF_PAGE.right, bold: true },
    ],
  })
  rows.push({
    runs: [{ text: `Year to date (posted) · gross ${input.ytdGross} · net ${input.ytdNet}` }],
  })
  return buildTextPdf(rows)
}
