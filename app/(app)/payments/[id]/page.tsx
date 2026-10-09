import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PencilIcon } from 'lucide-react'

import { DeleteButton } from '@/components/data/delete-record'
import { PageHeader } from '@/components/data/page-header'
import { RecordedBy } from '@/components/data/recorded-by'
import { RowActions } from '@/components/data/row-actions'
import { DocumentActions } from '@/components/print/document-actions'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatTransactionDate, toCalendarDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { PAYMENT_METHOD_LABELS, STATUS_LABELS, STATUS_VARIANTS } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import { trailFor } from '@/server/services/audit.service'
import * as paymentService from '@/server/services/payment.service'

export const metadata: Metadata = { title: 'Payment' }

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOrgContext('payment:read')
  const payment = await paymentService.get(ctx, id).catch(() => null)
  if (!payment) notFound()

  const trail = await trailFor(ctx, payment.id)
  const currency = ctx.organization.baseCurrency
  const canEdit = ctx.permissions.has('payment:update') && payment.status !== 'VOID'
  const canDelete = ctx.features.allowDocumentDelete && ctx.permissions.has('payment:void') && payment.status !== 'VOID'
  const canEditInvoice = ctx.permissions.has('invoice:update')
  const canReport = ctx.permissions.has('report:read')

  const quickReport = `/reports/statements/customer?customerId=${payment.customer.id}&view=detail`
  const paymentListReport = `/reports/payments-received?period=all-dates`

  return (
    <>
      <PageHeader
        className="print:hidden"
        title={`Payment ${payment.number}`}
        description={payment.customer.displayName}
        actions={
          <>
            <DocumentActions
              paper="payment receipt"
              defaultTo={payment.customer.email ?? ''}
              defaultSubject={`Payment ${payment.number} — ${ctx.organization.name}`}
              defaultBody={[
                `Payment ${payment.number}`,
                `Customer: ${payment.customer.displayName}`,
                `Date: ${formatTransactionDate(toCalendarDate(payment.date), payment.createdAt, ctx.organization.timeZone)}`,
                `Amount: ${formatMoney(payment.amount, currency)}`,
                '',
                `From ${ctx.organization.name}`,
              ].join('\n')}
              whatsappPhone={payment.customer.phone}
            />
            {canReport ? (
              <Link href={quickReport} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                QuickReport
              </Link>
            ) : null}
            {canEdit ? (
              <Link
                href={`/payments/${id}/edit`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <PencilIcon /> Edit
              </Link>
            ) : null}
            {canDelete ? (
              <DeleteButton
                kind="customer-payment"
                id={id}
                number={payment.number}
                redirectTo="/payments"
              />
            ) : null}
          </>
        }
      />

      <RecordedBy trail={trail} timeZone={ctx.organization.timeZone} />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Status" tone={payment.status === 'VOID' ? 'danger' : 'info'}>
          <Badge variant={STATUS_VARIANTS[payment.status] ?? 'secondary'}>
            {STATUS_LABELS[payment.status] ?? payment.status}
          </Badge>
        </Detail>
        <Detail label="Date" tone="zero">
          {formatTransactionDate(toCalendarDate(payment.date), payment.createdAt, ctx.organization.timeZone)}
        </Detail>
        <Detail label="Amount" tone="money">
          <span className="tabular font-semibold">{formatMoney(payment.amount, currency)}</span>
        </Detail>
        <Detail label="Unapplied" tone={Number(payment.unapplied) === 0 ? 'zero' : 'warning'}>
          <span className="tabular font-semibold">
            {Number(payment.unapplied) === 0 ? '—' : formatMoney(payment.unapplied, currency)}
          </span>
        </Detail>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Customer" tone="sales">
          <Link
            href={`/customers?id=${payment.customer.id}`}
            className="underline-offset-4 hover:underline"
          >
            {payment.customer.displayName}
          </Link>
        </Detail>
        <Detail label="Method" tone="neutral">
          {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
        </Detail>
        <Detail label="Deposit to" tone="neutral">
          {payment.depositAccount.code} {payment.depositAccount.name}
        </Detail>
        {payment.reference ? (
          <Detail label="Reference" tone="neutral">
            {payment.reference}
          </Detail>
        ) : null}
        {payment.memo ? (
          <Detail label="Note" tone="neutral">
            {payment.memo}
          </Detail>
        ) : null}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="panel-head text-sm font-semibold">Applied to invoices</div>
        {payment.applications.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Nothing applied yet — this amount sits as a credit on the customer until it is put against
            an invoice.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="numeric">Invoice total</TableHead>
                <TableHead className="numeric">Applied</TableHead>
                <TableHead className="w-12 print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payment.applications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell className="tabular font-medium">
                    <Link
                      href={`/sales/invoices/${application.invoice.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {application.invoice.number}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular text-muted-foreground">
                    {formatDate(toCalendarDate(application.invoice.date))}
                  </TableCell>
                  <TableCell className="numeric tabular">
                    {formatMoney(application.invoice.total, currency)}
                  </TableCell>
                  <TableCell className="numeric tabular font-medium">
                    {formatMoney(application.amount, currency)}
                  </TableCell>
                  <TableCell className="print:hidden">
                    <RowActions
                      actions={[
                        {
                          label: 'Open',
                          href: `/sales/invoices/${application.invoice.id}`,
                          icon: 'open',
                        },
                        ...(canEditInvoice
                          ? [
                              {
                                label: 'Edit',
                                href: `/sales/invoices/${application.invoice.id}/edit`,
                                icon: 'edit' as const,
                              },
                            ]
                          : []),
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex justify-end border-t p-4">
          <dl className="min-w-56 space-y-1 text-sm">
            <div className="flex justify-between gap-8">
              <dt className="text-muted-foreground">Received</dt>
              <dd className="tabular">{formatMoney(payment.amount, currency)}</dd>
            </div>
            <div className="flex justify-between gap-8">
              <dt className="text-muted-foreground">Applied</dt>
              <dd className="tabular">{formatMoney(payment.applied, currency)}</dd>
            </div>
            <div className="flex justify-between gap-8 border-t pt-1 font-semibold">
              <dt>Unapplied</dt>
              <dd className="tabular">{formatMoney(payment.unapplied, currency)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {payment.journal ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Posted as{' '}
          <Link
            href={`/journals/${payment.journal.id}`}
            className="font-medium underline underline-offset-4"
          >
            {payment.journal.journalNumber}
          </Link>
          . Editing the amount, date, customer, or deposit account reverses that entry and posts a
          replacement — both stay on the record.
        </p>
      ) : null}

      {canReport ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Also see the{' '}
          <Link href={paymentListReport} className="font-medium underline underline-offset-4">
            invoice payment list
          </Link>{' '}
          and this customer&apos;s{' '}
          <Link href={quickReport} className="font-medium underline underline-offset-4">
            QuickReport
          </Link>
          .
        </p>
      ) : null}
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
