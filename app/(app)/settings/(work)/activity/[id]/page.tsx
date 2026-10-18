import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftIcon, ExternalLinkIcon, EyeIcon, FileDownIcon } from 'lucide-react'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import { requireOrgContext } from '@/server/auth/context'
import * as trashService from '@/server/services/trash.service'
import { ClearTrashEntryButton } from '../clear-trash-button'
import { RestoreTrashButton } from '../restore-button'
import { TrashPapers } from '../trash-papers'

export const metadata: Metadata = { title: 'Trash' }

export default async function TrashDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext('audit:read')
  const { id } = await params
  const entry = await trashService.get(ctx, id).catch(() => null)
  if (!entry) notFound()
  const canClear = ctx.permissions.has('org:update')

  const pdfHref = `/api/trash/${id}/pdf`
  const title = entry.name ? `${entry.kind} ${entry.name}` : entry.kind
  const label = entry.name ? `${entry.kind} ${entry.name}` : entry.kind

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/settings/activity" className="hover:text-foreground hover:underline">
          Trash
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">{title}</span>
      </nav>

      <PageHeader
        title={title}
        description={
          entry.restored
            ? `Restored earlier. Deleted ${formatDateTime(new Date(entry.at), ctx.organization.timeZone)} by ${entry.who}.`
            : `Deleted ${formatDateTime(new Date(entry.at), ctx.organization.timeZone)} by ${entry.who}. Read the form below, open the PDF paper, then go back to Trash or restore into the books.`
        }
        actions={
          <>
            <Link
              href="/settings/activity"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ArrowLeftIcon /> Back to Trash
            </Link>
            <a
              href={pdfHref}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <EyeIcon /> Open PDF
            </a>
            <a
              href={`${pdfHref}?download=1`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <FileDownIcon /> Download PDF
            </a>
            {!entry.restored ? (
              <RestoreTrashButton
                id={id}
                label={label}
                disabledReason={entry.canRestore ? null : entry.cannotRestoreReason}
              />
            ) : null}
            {!entry.restored && canClear ? <ClearTrashEntryButton id={id} label={label} /> : null}
          </>
        }
      />

      {entry.origin ? (
        <p className="text-sm text-muted-foreground">
          Came from{' '}
          <Link
            href={entry.origin.href}
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            {entry.origin.label}
            <ExternalLinkIcon className="size-3.5" />
          </Link>
          <span className="mx-1.5 text-border">·</span>
          That is the list it belonged to. Use Back to Trash when you are done here.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-medium">Form · {entry.kind}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {entry.snapshot.length > 0 ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                {entry.snapshot.map((field) => (
                  <div
                    key={`${field.label}:${field.value}`}
                    className="rounded-md border border-border/80 bg-muted/20 px-3 py-2"
                  >
                    <dt className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                      {field.label}
                    </dt>
                    <dd className="mt-1 text-sm font-medium break-words text-foreground">
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No form fields were stored on this delete.</p>
            )}

            {/*
              Embedded PDF viewers stay blank in Electron / some in-app browsers.
              The form fields above are the on-screen paper; open PDF in a tab.
            */}
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-3">
              <p className="mr-auto text-sm text-muted-foreground">
                Paper PDF for printing or sharing.
              </p>
              <a
                href={pdfHref}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ size: 'sm' })}
              >
                <EyeIcon /> Open PDF
              </a>
              <a
                href={`${pdfHref}?download=1`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <FileDownIcon /> Download
              </a>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <p>
                <span className="block text-xs text-muted-foreground">Kind</span>
                {entry.kind}
              </p>
              {entry.name ? (
                <p>
                  <span className="block text-xs text-muted-foreground">Number / name</span>
                  {entry.name}
                </p>
              ) : null}
              {entry.origin ? (
                <p>
                  <span className="block text-xs text-muted-foreground">Came from</span>
                  <Link
                    href={entry.origin.href}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {entry.origin.label}
                  </Link>
                </p>
              ) : null}
              <p>
                <span className="block text-xs text-muted-foreground">Deleted by</span>
                {entry.who}
                {entry.email ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{entry.email}</span>
                ) : null}
              </p>
              <p>
                <span className="block text-xs text-muted-foreground">When</span>
                {formatDateTime(new Date(entry.at), ctx.organization.timeZone)}
              </p>
              <p>
                <span className="block text-xs text-muted-foreground">Reason</span>
                {entry.reason ?? '—'}
              </p>
            </CardContent>
          </Card>

          <TrashPapers auditLogId={id} files={entry.files} />

          <Link
            href="/settings/activity"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}
          >
            <ArrowLeftIcon /> Back to Trash
          </Link>
        </div>
      </div>
    </div>
  )
}
