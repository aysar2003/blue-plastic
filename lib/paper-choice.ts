import { type DocumentTemplate, type PaperStyle } from '@/lib/document-template'

/** Remembered on this browser so Print and PDF use the same sheet everywhere. */
export const PAPER_CHOICE_COOKIE = 'bpc-paper'

export function parsePaperChoice(value: string | null | undefined): PaperStyle | null {
  if (value === 'trade' || value === 'merchant') return value
  return null
}

export function applyPaperChoice(
  template: DocumentTemplate,
  choice: PaperStyle | null | undefined,
): DocumentTemplate {
  if (!choice || choice === template.paperStyle) return template
  return { ...template, paperStyle: choice }
}

export function paperChoiceCookie(style: PaperStyle): string {
  return `${PAPER_CHOICE_COOKIE}=${style}; Path=/; Max-Age=31536000; SameSite=Lax`
}
