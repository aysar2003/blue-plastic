import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ManualMarkdown } from '@/components/help/manual-markdown'
import { PageHeader } from '@/components/data/page-header'
import { MANUAL_CHAPTERS, chapterTitle, type ManualLang } from '@/content/user-manual'
import { loadChapter } from '@/content/user-manual/load'
import { requireOrgContext } from '@/server/auth/context'

type Props = { params: Promise<{ lang: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id } = await params
  const meta = MANUAL_CHAPTERS.find((c) => c.id === id)
  if (!meta || (lang !== 'en' && lang !== 'so')) return { title: 'User manual' }
  return { title: chapterTitle(meta, lang) }
}

export default async function HelpManualChapterPage({ params }: Props) {
  await requireOrgContext()
  const { lang: langRaw, id } = await params
  if (langRaw !== 'en' && langRaw !== 'so') notFound()
  const lang = langRaw as ManualLang

  const chapter = loadChapter(id, lang)
  if (!chapter) notFound()

  const ordered = [...MANUAL_CHAPTERS].sort((a, b) => a.order - b.order)
  const index = ordered.findIndex((c) => c.id === id)
  const prev = index > 0 ? ordered[index - 1] : null
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null
  const otherLang: ManualLang = lang === 'en' ? 'so' : 'en'

  return (
    <>
      <PageHeader
        title={`${chapter.order}. ${chapterTitle(chapter, lang)}`}
        description={
          lang === 'so'
            ? 'Buugga isticmaalaha — Soomaali. Magacyada badhamada waa English.'
            : 'User manual — English. Control names match the screens.'
        }
      />

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/help/manual" className="underline underline-offset-4">
          {lang === 'so' ? 'Dhammaan cutubyada' : 'All chapters'}
        </Link>
        <Link
          href={`/help/manual/${otherLang}/${id}`}
          className="underline underline-offset-4"
        >
          {otherLang === 'so' ? 'Soomaali' : 'English'}
        </Link>
        {chapter.href ? (
          <Link href={chapter.href} className="underline underline-offset-4">
            {lang === 'so' ? 'Fur screen-ka' : 'Open screen'}
          </Link>
        ) : null}
      </div>

      <ManualMarkdown source={chapter.body} />

      <nav className="mt-10 flex flex-wrap justify-between gap-3 border-t pt-4 text-sm">
        {prev ? (
          <Link
            href={`/help/manual/${lang}/${prev.id}`}
            className="underline underline-offset-4"
          >
            ← {chapterTitle(prev, lang)}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/help/manual/${lang}/${next.id}`}
            className="underline underline-offset-4"
          >
            {chapterTitle(next, lang)} →
          </Link>
        ) : null}
      </nav>
    </>
  )
}
