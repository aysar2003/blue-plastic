/**
 * A small PDF writer for statements, sales papers, and month exports.
 *
 * Standard fonts only. Rows can carry fills and text colours so documents
 * can share an Odoo-style purple letterhead without a heavier PDF stack.
 * Barcode rows draw Code 128 as filled rectangles (no image XObjects).
 */

import { canEncodeCode128, code128Layout } from '@/lib/barcode-code128-svg'
import { toMonoRgb, type PrintInk } from '@/lib/print-ink'

export type PdfRgb = readonly [number, number, number]

export type PdfRun = {
  text: string
  x?: number
  bold?: boolean
  /** Left edge (default), centre of page, or right edge at `x`. */
  align?: 'left' | 'center' | 'right'
  color?: PdfRgb
}

/** Scannable Code 128 drawn with PDF path operators (black bars). */
export type PdfBarcode = {
  text: string
  /** Left edge of the quiet zone; ignored when align is right/center. */
  x?: number
  align?: 'left' | 'center' | 'right'
  moduleWidth?: number
  barHeight?: number
  showText?: boolean
}

export type PdfRow = {
  size?: number
  height?: number
  runs: PdfRun[]
  rule?: boolean
  /** Full-width band behind the row (letterhead / table head). */
  fill?: PdfRgb
  /** Left/right inset for the fill; defaults to 0 (edge-to-edge). */
  fillInset?: number
  /** Optional document / line barcode under the runs. */
  barcode?: PdfBarcode
  /** Force the next rows onto a new page (invoice-by-invoice packs). */
  pageBreak?: boolean
}

/** US Letter. Shared gutters so every paper lines up. */
export const PDF_PAGE = {
  width: 612,
  height: 792,
  /** Left content margin. */
  left: 40,
  /** Right content edge (text / right-aligned amounts). */
  right: 572,
  /** Top margin used by `buildTextPdf`. */
  top: 36,
  /** Bottom margin used by `buildTextPdf`. */
  bottom: 40,
} as const

const LETTER = { width: PDF_PAGE.width, height: PDF_PAGE.height }

export function buildTextPdf(
  rows: PdfRow[],
  options: { width?: number; height?: number; header?: PdfRow[]; ink?: PrintInk } = {},
): Uint8Array {
  const width = options.width ?? LETTER.width
  const height = options.height ?? LETTER.height
  const ink = options.ink ?? 'color'
  const top = height - PDF_PAGE.top
  const bottom = PDF_PAGE.bottom
  const header = options.header ?? []
  const headerHeight = header.reduce((sum, row) => sum + (row.height ?? 14), 0)

  const pages: PdfRow[][] = []
  let current: PdfRow[] = []
  let y = top - headerHeight
  for (const row of rows) {
    if (row.pageBreak) {
      if (current.length > 0) {
        pages.push(current)
        current = []
        y = top - headerHeight
      }
      continue
    }
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
    const stream = pageStream([...header, ...pageRows], width, top, ink)
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

function pageStream(rows: PdfRow[], pageWidth: number, top: number, ink: PrintInk): string {
  const paint = (rgb: PdfRgb): PdfRgb => (ink === 'mono' ? toMonoRgb(rgb) : rgb)
  let y = top
  const parts: string[] = []
  for (const row of rows) {
    const size = row.size ?? 9
    const height = row.height ?? 14
    y -= height
    if (row.fill) {
      const inset = row.fillInset ?? 0
      const [r, g, b] = paint(row.fill)
      parts.push(
        `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ` +
          `${inset} ${y - 2} ${pageWidth - inset * 2} ${height + 2} re f`,
      )
    }
    if (row.rule) {
      parts.push(
        `0.75 0.75 0.75 RG ${PDF_PAGE.left} ${y + height - 3} m ${PDF_PAGE.right} ${y + height - 3} l S`,
      )
    }
    if (row.runs.length > 0) {
      parts.push('BT')
      for (const run of row.runs) {
        const font = run.bold ? 'F2' : 'F1'
        const align = run.align ?? 'left'
        const x =
          align === 'center'
            ? centeredX(run.text, size, pageWidth)
            : align === 'right'
              ? rightAlignedX(run.text, size, run.x ?? PDF_PAGE.right)
              : (run.x ?? PDF_PAGE.left)
        if (run.color) {
          const [r, g, b] = paint(run.color)
          parts.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`)
        } else if (row.fill) {
          // Light fill bands keep dark text; purple letterhead uses white runs.
          parts.push('0 0 0 rg')
        }
        parts.push(`/${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfText(run.text)}) Tj`)
      }
      parts.push('ET')
    }
    if (row.barcode && canEncodeCode128(row.barcode.text)) {
      parts.push(barcodeStream(row.barcode, y, pageWidth, height))
    }
  }
  return parts.join('\n')
}

/**
 * Draw Code 128 bars inside the row band. Bars sit near the top of the band;
 * optional human-readable text sits just above the row baseline.
 */
function barcodeStream(
  barcode: PdfBarcode,
  rowBottom: number,
  pageWidth: number,
  rowHeight: number,
): string {
  const moduleWidth = barcode.moduleWidth ?? 1.1
  const showText = barcode.showText ?? true
  const layout = code128Layout(barcode.text, moduleWidth)
  const textPad = showText ? 11 : 0
  const barHeight = Math.min(barcode.barHeight ?? 28, Math.max(12, rowHeight - textPad - 2))
  const align = barcode.align ?? 'left'
  const left =
    align === 'center'
      ? Math.max(PDF_PAGE.left, (pageWidth - layout.width) / 2)
      : align === 'right'
        ? Math.max(PDF_PAGE.left, (barcode.x ?? PDF_PAGE.right) - layout.width)
        : (barcode.x ?? PDF_PAGE.left)

  const barBottom = rowBottom + textPad
  const parts: string[] = ['0 0 0 rg']
  for (const bar of layout.bars) {
    const x = left + layout.quiet + bar.x
    parts.push(`${x.toFixed(2)} ${barBottom.toFixed(2)} ${bar.w.toFixed(2)} ${barHeight.toFixed(2)} re f`)
  }
  if (showText) {
    const labelX = left + layout.width / 2 - approxWidth(layout.text, 8) / 2
    parts.push('BT')
    parts.push(`/F1 8 Tf 1 0 0 1 ${labelX.toFixed(2)} ${rowBottom.toFixed(2)} Tm (${pdfText(layout.text)}) Tj`)
    parts.push('ET')
  }
  return parts.join('\n')
}

/** One PDF row that is only a scannable document barcode (right-aligned by default). */
export function pdfBarcodeRow(
  text: string,
  options: Omit<PdfBarcode, 'text'> & { height?: number } = {},
): PdfRow | null {
  if (!canEncodeCode128(text)) return null
  const height = options.height ?? 42
  return {
    height,
    runs: [],
    barcode: {
      text: text.trim(),
      x: options.x,
      align: options.align ?? 'right',
      moduleWidth: options.moduleWidth ?? 1.1,
      barHeight: options.barHeight ?? 28,
      showText: options.showText ?? true,
    },
  }
}

/** Helvetica is about half an em wide — close enough for layout. */
function approxWidth(text: string, size: number) {
  return pdfText(text).length * size * 0.5
}

function centeredX(text: string, size: number, pageWidth: number) {
  return Math.max(24, Math.round((pageWidth - approxWidth(text, size)) / 2))
}

function rightAlignedX(text: string, size: number, rightEdge: number) {
  return Math.max(PDF_PAGE.left, Math.round(rightEdge - approxWidth(text, size)))
}

function pdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}
