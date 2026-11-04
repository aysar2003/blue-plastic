import 'server-only'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { MANUAL_CHAPTERS, type ManualChapterMeta, type ManualLang } from './index'

export { assembleManualMarkdown } from './assemble'

const ROOT = join(process.cwd(), 'content', 'user-manual', 'chapters')

export type LoadedChapter = ManualChapterMeta & {
  body: string
}

export function loadChapterBody(file: string, lang: ManualLang): string {
  return readFileSync(join(ROOT, `${file}.${lang}.md`), 'utf8')
}

export function loadChapter(id: string, lang: ManualLang): LoadedChapter | null {
  const meta = MANUAL_CHAPTERS.find((c) => c.id === id)
  if (!meta) return null
  return { ...meta, body: loadChapterBody(meta.file, lang) }
}

export function loadAllChapters(lang: ManualLang): LoadedChapter[] {
  return [...MANUAL_CHAPTERS]
    .sort((a, b) => a.order - b.order)
    .map((meta) => ({ ...meta, body: loadChapterBody(meta.file, lang) }))
}
