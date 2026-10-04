/**
 * A small PDF writer for a statement or a month export.
 *
 * Standard fonts only, one column of rows, page breaks when the page fills.
 * A run can sit at an x position or be centred on the page.
 */

export type PdfRun = { text: string; x?: number; bold?: boolean; align?: 'center' }
export type PdfRow = { size?: number; height?: number; runs: PdfRun[]; rule?: boolean }

const LETTER = { width: 612, height: 792 }

export function buildTextPdf(
  rows: PdfRow[],
  options: { width?: number; height?: number; header?: PdfRow[] } = {},
): Uint8Array {
  const width = options.width ?? LETTER.width
  const height = options.height ?? LETTER.height
  const top = height - 42
  const bottom = 40
  const header = options.header ?? []
  const headerHeight = header.reduce((sum, row) => sum + (row.height ?? 14), 0)

  const pages: PdfRow[][] = []
  let current: PdfRow[] = []
  let y = top - headerHeight
  for (const row of rows) {
    const rowHeight = row.height ?? 14
    if (y - rowHeight < bottom && current.length > 0) {
      pages.push(current)
      current = []
      y = top - headerHeight
    }
    current.push(row)
    y -= rowHeight
  }
  if (current.length > 0 || pages.length === 0) pages.push(current)

  const objects: string[] = []
  const add = (body: string) => {
    objects.push(body)
    return objects.length
  }

  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')

  const pageIds: number[] = []
  for (const pageRows of pages) {
    const stream = pageStream([...header, ...pageRows], width, top)
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    const page = add(
      `<< /Type /Page /Parent PAGES /MediaBox [0 0 ${width} ${height}] ` +
        `/Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`,
    )
    pageIds.push(page)
  }

  const pagesId = add(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`,
  )
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (let index = 0; index < objects.length; index++) {
    offsets.push(pdf.length)
    const body = objects[index]!.replaceAll('PAGES', `${pagesId} 0 R`)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  }
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let index = 1; index < offsets.length; index++) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new TextEncoder().encode(pdf)
}

function pageStream(rows: PdfRow[], pageWidth: number, top: number): string {
  let y = top
  const parts: string[] = []
  for (const row of rows) {
    const size = row.size ?? 9
    const height = row.height ?? 14
    y -= height
    if (row.rule) {
      parts.push(`0.75 0.75 0.75 RG 40 ${y + height - 3} m ${pageWidth - 40} ${y + height - 3} l S`)
    }
    if (row.runs.length > 0) {
      parts.push('BT')
      for (const run of row.runs) {
        const font = run.bold ? 'F2' : 'F1'
        const x = run.align === 'center' ? centeredX(run.text, size, pageWidth) : (run.x ?? 40)
        parts.push(`/${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfText(run.text)}) Tj`)
      }
      parts.push('ET')
    }
  }
  return parts.join('\n')
}

/** Helvetica is about half an em wide, which is close enough to centre a heading. */
function centeredX(text: string, size: number, pageWidth: number) {
  const width = pdfText(text).length * size * 0.5
  return Math.max(24, Math.round((pageWidth - width) / 2))
}

function pdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}
