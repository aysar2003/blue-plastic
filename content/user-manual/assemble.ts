/**
 * Assemble printable manuals without importing server-only load.ts
 * (scripts run outside Next).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { MANUAL_CHAPTERS, type ManualLang } from './index'

const ROOT = join(process.cwd(), 'content', 'user-manual', 'chapters')

export function assembleManualMarkdown(lang: ManualLang): string {
  const title =
    lang === 'so'
      ? '# Buugga isticmaalaha — SOM ERP\n\nHagitaan tallaabo-tallaabo. Magacyada badhamada iyo menu-yada waa **English** sida screen-ka; sharaxaadda waa Soomaali.\n'
      : '# SOM ERP — User manual\n\nStep-by-step guide for people who work in the system. Button and menu names match the **English** screens.\n'

  const parts = [title]
  for (const ch of [...MANUAL_CHAPTERS].sort((a, b) => a.order - b.order)) {
    const heading = lang === 'so' ? ch.titleSo : ch.titleEn
    const body = readFileSync(join(ROOT, `${ch.file}.${lang}.md`), 'utf8')
    parts.push(`\n---\n\n## ${ch.order}. ${heading}\n\n${body.trim()}\n`)
  }
  return parts.join('\n')
}
