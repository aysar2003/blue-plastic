/**
 * Code 128 (subset B) as SVG / PDF bars — no barcode npm package.
 * Encodes digits and common SKU / document letters so USB scanners and
 * label printers can read labels and papers printed from the browser.
 */

/** Each entry is six widths: bar, space, bar, space, bar, space (STOP has 7). */
const CODE128: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212',
  '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221',
  '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221',
  '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321',
  '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131',
  '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131',
  '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111',
  '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242',
  '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311',
  '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]

const START_B = 104
const STOP = 106

export type Code128Bar = { x: number; w: number }

export type Code128Layout = {
  text: string
  bars: Code128Bar[]
  /** Quiet zone on each side (same units as bar x/w). */
  quiet: number
  /** Width of the bar pattern only (no quiet zones). */
  contentWidth: number
  /** Total SVG/PDF width including quiet zones. */
  width: number
}

function valueForChar(ch: string): number {
  const code = ch.charCodeAt(0)
  if (code < 32 || code > 126) {
    throw new Error(`Code 128 B cannot encode character code ${code}`)
  }
  return code - 32
}

/** True when every character fits Code 128 subset B (printable ASCII). */
export function canEncodeCode128(text: string): boolean {
  const raw = text.trim()
  if (!raw) return false
  for (const ch of raw) {
    const code = ch.charCodeAt(0)
    if (code < 32 || code > 126) return false
  }
  return true
}

/**
 * Bar geometry for Code 128 B. Shared by SVG labels and the PDF drawer so
 * invoice / delivery papers scan the same way as product stickers.
 */
export function code128Layout(text: string, moduleWidth = 1.4): Code128Layout {
  const raw = text.trim()
  if (!raw) throw new Error('Barcode text is empty')

  const values = [...raw].map(valueForChar)
  let checksum = START_B
  values.forEach((value, i) => {
    checksum += value * (i + 1)
  })
  checksum %= 103

  const sequence = [START_B, ...values, checksum, STOP]
  const bars: Code128Bar[] = []
  let x = 0
  for (const index of sequence) {
    const pattern = CODE128[index]
    if (!pattern) throw new Error(`Unknown Code 128 index ${index}`)
    let bar = true
    for (const digit of pattern) {
      const w = Number(digit) * moduleWidth
      if (bar) bars.push({ x, w })
      x += w
      bar = !bar
    }
  }

  const quiet = moduleWidth * 10
  return {
    text: raw,
    bars,
    quiet,
    contentWidth: x,
    width: x + quiet * 2,
  }
}

/** SVG markup for a Code 128 barcode (black bars, optional human-readable text). */
export function code128Svg(
  text: string,
  options: { height?: number; moduleWidth?: number; showText?: boolean } = {},
): string {
  const height = options.height ?? 52
  const moduleWidth = options.moduleWidth ?? 1.4
  const showText = options.showText ?? true
  const layout = code128Layout(text, moduleWidth)

  const barHeight = showText ? height - 14 : height
  const rects = layout.bars
    .map(
      (bar) =>
        `<rect x="${(layout.quiet + bar.x).toFixed(2)}" y="0" width="${bar.w.toFixed(2)}" height="${barHeight}" fill="#000"/>`,
    )
    .join('')
  const label = showText
    ? `<text x="${(layout.width / 2).toFixed(2)}" y="${height - 2}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#000">${escapeXml(layout.text)}</text>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width.toFixed(2)}" height="${height}" viewBox="0 0 ${layout.width.toFixed(2)} ${height}" role="img" aria-label="${escapeXml(layout.text)}">${rects}${label}</svg>`
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
