import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MANUAL_CHAPTERS, chapterTitle } from '@/content/user-manual'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'User manual' }

export default async function HelpManualHubPage() {
  await requireOrgContext()
  const chapters = [...MANUAL_CHAPTERS].sort((a, b) => a.order - b.order)

  return (
    <>
      <PageHeader
        title="User manual"
        description="Full step-by-step book in English and Somali. Button names match the English screens."
      />

      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link href="/help/guide" className="underline underline-offset-4">
          Short guide (EN)
        </Link>
        <Link href="/help/guide-so" className="underline underline-offset-4">
          Hagitaan gaaban (SO)
        </Link>
        <Link href="/help/manual/en/intro" className="underline underline-offset-4">
          Start EN book
        </Link>
        <Link href="/help/manual/so/intro" className="underline underline-offset-4">
          Bilow buugga SO
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">English chapters</CardTitle>
            <CardDescription>For accountants and bilingual staff.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {chapters.map((ch) => (
                <li key={ch.id} className="flex gap-2">
                  <span className="tabular text-muted-foreground">{ch.order}.</span>
                  <Link
                    href={`/help/manual/en/${ch.id}`}
                    className="text-foreground underline underline-offset-4"
                  >
                    {chapterTitle(ch, 'en')}
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cutubyada Soomaaliga</CardTitle>
            <CardDescription>Shaqaalaha aan aqoon hore u lahayn.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {chapters.map((ch) => (
                <li key={ch.id} className="flex gap-2">
                  <span className="tabular text-muted-foreground">{ch.order}.</span>
                  <Link
                    href={`/help/manual/so/${ch.id}`}
                    className="text-foreground underline underline-offset-4"
                  >
                    {chapterTitle(ch, 'so')}
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Printable files</CardTitle>
          <CardDescription>
            Same content as these pages, assembled as Markdown under{' '}
            <code className="text-foreground">docs/user-manual/</code> in the project (for print or
            offline share).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>
            <code className="text-foreground">SOM-ERP-User-Manual.en.md</code>
            {' · '}
            <code className="text-foreground">SOM-ERP-User-Manual.so.md</code>
          </p>
          <p>
            Walkthrough notes for maintainers:{' '}
            <code className="text-foreground">docs/user-manual/walkthrough-findings.md</code>
          </p>
        </CardContent>
      </Card>
    </>
  )
}
