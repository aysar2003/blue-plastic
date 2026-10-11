import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftIcon, FileDownIcon, EyeIcon } from 'lucide-react'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateTime } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as trashService from '@/server/services/trash.service'
import { TrashPapers } from '../trash-papers'

export const metadata: Metadata = { title: 'Trash' }

export default async function TrashDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext('audit:read')
  const { id } = await params
  const entry = await trashService.get(ctx, id).catch(() => null)
  if (!entry) notFound()

  const pdfHref = `/api/trash/${id}/pdf`
  const title = entry.name ? `${entry.kind} ${entry.name}` : entry.kind

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={`Deleted ${formatDateTime(new Date(entry.at), ctx.organization.timeZone)} by ${entry.who}. Download the form as PDF, then upload papers below. Not in the company books.`}
        actions={
          <>
            <Link href="/settings/activity" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <ArrowLeftIcon /> Trash
            </Link>
            <a href={pdfHref} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <EyeIcon /> View PDF
            </a>
            <a href={`${pdfHref}?download=1`} className={buttonVariants({ size: 'sm' })}>
              <FileDownIcon /> Download PDF
            </a>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-2 pt-4 text-sm">
          <p>
            <span className="text-muted-foreground">Kind</span> · {entry.kind}
          </p>
          {entry.name ? (
            <p>
              <span className="text-muted-foreground">Number / name</span> · {entry.name}
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">Deleted by</span> · {entry.who}
            {entry.email ? ` (${entry.email})` : ''}
          </p>
          <p>
            <span className="text-muted-foreground">When</span> ·{' '}
            {formatDateTime(new Date(entry.at), ctx.organization.timeZone)}
          </p>
          <p>
            <span className="text-muted-foreground">Reason</span> · {entry.reason ?? '—'}
          </p>
        </CardContent>
      </Card>

      <TrashPapers auditLogId={id} files={entry.files} />
    </div>
  )
}
