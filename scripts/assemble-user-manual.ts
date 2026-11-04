/**
 * Writes printable manuals from content/user-manual/chapters/*.md
 *
 *   pnpm exec tsx scripts/assemble-user-manual.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { assembleManualMarkdown } from '../content/user-manual/assemble'

const outDir = join(process.cwd(), 'docs', 'user-manual')
mkdirSync(outDir, { recursive: true })

for (const lang of ['en', 'so'] as const) {
  const body = assembleManualMarkdown(lang)
  const file = join(outDir, `SOM-ERP-User-Manual.${lang}.md`)
  writeFileSync(file, body, 'utf8')
  console.log(`Wrote ${file} (${body.length} chars)`)
}
