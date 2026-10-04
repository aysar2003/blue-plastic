import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PencilIcon } from 'lucide-react'

import { PageHeader } from '@/components/data/page-header'
import { RecordedBy } from '@/components/data/recorded-by'
import { ConvertEstimateButton } from '@/components/sales/document-actions'
import { DeleteButton } from '@/components/data/delete-record'
import { DocumentActions } from '@/components/print/document-actions'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, toCalendarDate, today } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { bySlug, STATUS_LABELS, STATUS_VARIANTS } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import { trailFor } from '@/server/services/audit.service'
import * as salesService from '@/server/services/sales.service'

export const metadata: Metadata = { title: 'Document' }

export default async function SalesDocumentPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>
}) {
  const { type, id } = await params
  const config = bySlug(type)
  if (!config) notFound()

  const ctx = await requireOrgContext('invoice:read')
  const document = await salesService.get(ctx, id).catch(() => null)
  if (!document) notFound()
  const trail = await trailFor(ctx, document.id)

  const currency = ctx.organization.baseCurrency
  // A draft can now be deleted, so the control shows for it too — what it does
  // is decided by `disposition` below.
  const canDelete = ctx.permissions.has('invoice:void') && document.status !== 'VOID'

  // The same rule the service enforces: a voided document cannot be edited, and
  // neither can one with money already applied to it — the payment would have to
  // be unpicked first. Better to hide the button than to explain the refusal.
  const applied = document.applications.length > 0
  const canEdit = ctx.permissions.has('invoice:update') && document.status !== 'VOID' && !applied
  const canConvert =
    config.type === 'ESTIMATE' &&
    ctx.permissions.has('invoice:create') &&
    !document.convertedTo &&
    document.status !== 'VOID' &&
    document.status !== 'DECLINED'

  const shareBody = [
    `${config.singular} ${document.number}`,
    `To: ${document.customer.displayName}`,
    `Date: ${formatDate(toCalendarDate(document.date))}`,
    `Total: ${formatMoney(document.total, currency)}`,
    Number(document.balance) > 0
      ? `Amount due: ${formatMoney(document.balance, currency)}`
      : null,
    '',
    `From ${ctx.organization.name}`,
  ]
    .filter((line) => line !== null)
    .join('\n')

  return (
    <>

      <PageHeader
        title={`${config.singular} ${document.number}`}
        description={document.customer.displayName}
        actions={
          <>
            <DocumentActions
              paper={config.singular.toLowerCase()}
              printHref={`/sales/${config.slug}/${id}/print`}
              pdfHref={`/api/sales/${id}/pdf`}
              filename={`${config.slug.replace(/s$/, '')}-${document.number
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')}.pdf`}
              defaultTo={document.customer.email ?? ''}
              defaultSubject={`${config.singular} ${document.number} from ${ctx.organization.name}`}
              defaultBody={shareBody}
              whatsappPhone={document.customer.phone}
              whatsappText={shareBody}
            />
            {canConvert ? (
              <ConvertEstimateButton
                id={id}
                number={document.number}
                today={today(ctx.organization.timeZone)}
              />
            ) : null}
            {canEdit ? (
              <Link
                href={`/sales/${config.slug}/${id}/edit`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <PencilIcon /> Edit
              </Link>
            ) : null}
            {canDelete ? (
              <DeleteButton
                kind="sales"
                id={id}
                number={document.number}
                redirectTo={`/sales/${config.slug}`}
              />
            ) : null}
          </>
        }
      />

      <RecordedBy trail={trail} timeZone={ctx.organization.timeZone} />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Detail
          label="Status"
          tone={
            document.status === 'PAID' || document.status === 'ACCEPTED'
              ? 'success'
              : document.status === 'VOID' || document.status === 'DECLINED'
                ? 'danger'
                : document.status === 'PARTIAL'
                  ? 'warning'
                  : 'info'
          }
        >
          <Badge variant={STATUS_VARIANTS[document.status] ?? 'secondary'}>
            {STATUS_LABELS[document.status] ?? document.status}
          </Badge>
        </Detail>
        <Detail label="Date" tone="zero">
          {formatDate(toCalendarDate(document.date))}
        </Detail>
        {document.dueDate ? (
          <Detail label="Due" tone="warning">
            {formatDate(toCalendarDate(document.dueDate))}
          </Detail>
        ) : null}
        <Detail label="Total" tone="money">
          <span className="tabular font-semibold">{formatMoney(document.total, currency)}</span>
        </Detail>
        {config.type === 'INVOICE' ? (
          <Detail label="Outstanding" tone="sales">
            <span className="tabular font-semibold">{formatMoney(document.balance, currency)}</span>
          </Detail>
        ) : null}
      </div>

      {document.status === 'VOID' ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
          Voided{document.voidReason ? ` — ${document.voidReason}` : ''}. Its entry was reversed; both
          remain in the ledger. Voiding was replaced by deleting — no new document reaches this
          state.
        </div>
      ) : null}

      {document.convertedTo ? (
        <div className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Became invoice{' '}
          <Link href={`/sales/invoices/${document.convertedTo.id}`} className="font-medium underline underline-offset-4">
            {document.convertedTo.number}
          </Link>
          .
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="numeric w-24">Qty</TableHead>
              <TableHead className="numeric w-28">Price</TableHead>
              <TableHead>Tax</TableHead>
              <TableHead>Posts to</TableHead>
              <TableHead className="numeric w-32">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {document.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <span className="block">{line.description ?? line.item?.name ?? '—'}</span>
                  {line.item ? (
                    <span className="block text-xs text-muted-foreground">{line.item.name}</span>
                  ) : null}
                </TableCell>
                <TableCell className="numeric tabular">{Number(line.quantity)}</TableCell>
                <TableCell className="numeric tabular">{formatMoney(line.unitPrice, currency)}</TableCell>
                <TableCell className="text-muted-foreground">{line.taxCode?.name ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {line.incomeAccount ? `${line.incomeAccount.code} ${line.incomeAccount.name}` : '—'}
                </TableCell>
                <TableCell className="numeric tabular">{formatMoney(line.amount, currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex justify-end border-t p-4">
          <dl className="min-w-56 space-y-1 text-sm">
            <Row label="Subtotal" value={formatMoney(document.subtotal, currency)} />
            <Row label="Tax" value={formatMoney(document.taxTotal, currency)} />
            <Row label="Total" value={formatMoney(document.total, currency)} bold />
            {config.type === 'INVOICE' ? (
              <>
                <Row label="Applied" value={formatMoney(document.amountApplied, currency)} />
                <Row label="Outstanding" value={formatMoney(document.balance, currency)} bold />
              </>
            ) : null}
          </dl>
        </div>
      </Card>

      {document.applications.length > 0 ? (
        <Card className="mt-4 overflow-hidden p-0">
          <div className="panel-head text-sm font-semibold">Settled by</div>
          <Table>
            <TableBody>
              {document.applications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell>
                    {application.payment ? `Payment ${application.payment.number}` : null}
                    {application.creditDocument ? `Credit memo ${application.creditDocument.number}` : null}
                  </TableCell>
                  <TableCell className="numeric tabular">
                    {formatMoney(application.amount, currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      {document.journal ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Posted as{' '}
          <Link href={`/journals/${document.journal.id}`} className="font-medium underline underline-offset-4">
            {document.journal.journalNumber}
          </Link>
          . Editing this document reverses that entry and posts a new one — both stay on the record.
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {config.posts ? 'Not posted to the ledger yet.' : config.effect}
        </p>
      )}
    </>
  )
}

function Detail({
  label,
  children,
  tone = 'neutral',
}: {
  label: string
  children: React.ReactNode
  tone?: 'neutral' | 'zero' | 'warning' | 'success' | 'danger' | 'money' | 'sales' | 'info'
}) {
  return (
    <Card tone={tone}>
      <CardContent className="p-3">
        <p className="text-xs font-medium uppercase tracking-wider opacity-75">{label}</p>
        <div className="mt-0.5 text-sm font-medium">{children}</div>
      </CardContent>
    </Card>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-8 ${bold ? 'border-t pt-1 font-semibold' : ''}`}>
      <dt className={bold ? '' : 'text-muted-foreground'}>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  )
}
