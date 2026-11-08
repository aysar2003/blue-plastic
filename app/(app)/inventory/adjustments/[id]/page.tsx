import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ApprovalTrailPanel } from '@/app/(app)/approvals/approval-trail-panel'
import { DeleteButton } from '@/components/data/delete-record'
import { DocumentHistory } from '@/components/data/document-history'
import { PageHeader } from '@/components/data/page-header'
import { RecordedBy } from '@/components/data/recorded-by'
import { DocumentActions } from '@/components/print/document-actions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatTransactionDate, toCalendarDate } from '@/lib/date'
import { formatMoney, formatSignedQuantity, ZERO } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { historyFor, trailFor } from '@/server/services/audit.service'
import * as inventoryService from '@/server/services/inventory.service'

export const metadata: Metadata = { title: 'Inventory adjustment' }

export default async function AdjustmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext('inventory:read')
  const { id } = await params

  const adjustment = await inventoryService.getAdjustment(ctx, id).catch(() => null)
  if (!adjustment) notFound()

  const [trail, history] = await Promise.all([trailFor(ctx, adjustment.id), historyFor(ctx, adjustment.id)])
  const currency = ctx.organization.baseCurrency
  const canDelete =
    ctx.features.allowDocumentDelete &&
    ctx.permissions.has('inventory:adjust') &&
    adjustment.status !== 'VOID'
  const totalValue = adjustment.lines.reduce((sum, line) => sum.plus(line.value), ZERO)

  return (
    <>
      <PageHeader
        className="print:hidden"
        title={adjustment.number}
        description={adjustment.reason ?? adjustment.memo ?? 'Inventory adjustment'}
        actions={
          <>
            <DocumentActions
              paper="inventory adjustment"
              filename={adjustment.number}
              pdfMatchesPrint
              defaultSubject={`${adjustment.number} — ${ctx.organization.name}`}
              defaultBody={[
                adjustment.number,
                adjustment.reason ?? adjustment.memo ?? '',
                `Date: ${formatTransactionDate(toCalendarDate(adjustment.date), adjustment.createdAt, ctx.organization.timeZone)}`,
                `Account: ${adjustment.account.code} ${adjustment.account.name}`,
                '',
                ctx.organization.name,
              ]
                .filter(Boolean)
                .join('\n')}
            />
            {canDelete ? (
              <DeleteButton
                kind="inventory-adjustment"
                id={adjustment.id}
                number={adjustment.number}
                redirectTo="/inventory/stock#adjustments"
              />
            ) : null}
          </>
        }
      />

      <RecordedBy trail={trail} timeZone={ctx.organization.timeZone} />

      <div data-print-root className="space-y-4">
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail
            label="Date"
            value={formatTransactionDate(
              toCalendarDate(adjustment.date),
              adjustment.createdAt,
              ctx.organization.timeZone,
            )}
          />
          <Detail
            label="Difference goes to"
            value={`${adjustment.account.code} ${adjustment.account.name}`}
            href={`/accounts/${adjustment.account.id}`}
          />
          <Detail label="Store" value={adjustment.store?.name ?? 'Office'} />
          <Detail
            label="Journal"
            value={adjustment.journal?.journalNumber ?? '—'}
            href={adjustment.journal ? `/journals/${adjustment.journal.id}` : undefined}
          />
        </div>

        {adjustment.status === 'VOID' ? (
          <div className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            This adjustment is void. Stock and the ledger entry were withdrawn.
          </div>
        ) : null}

        {adjustment.memo && adjustment.memo !== adjustment.reason ? (
          <p className="mb-4 text-sm text-muted-foreground">{adjustment.memo}</p>
        ) : null}

        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="numeric w-28">Books said</TableHead>
                <TableHead className="numeric w-28">Count found</TableHead>
                <TableHead className="numeric w-28">Change</TableHead>
                <TableHead className="numeric w-32">Unit cost</TableHead>
                <TableHead className="numeric w-32">Value</TableHead>
                <TableHead>Memo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustment.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <Link
                      href={`/items/${line.item.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {line.item.sku ? (
                        <>
                          <span className="tabular text-muted-foreground">{line.item.sku}</span>{' '}
                          {line.item.name}
                        </>
                      ) : (
                        line.item.name
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="numeric tabular">{line.previousQuantity}</TableCell>
                  <TableCell className="numeric tabular">{line.countedQuantity}</TableCell>
                  <TableCell className="numeric tabular">
                    {formatSignedQuantity(line.quantityChange)}
                  </TableCell>
                  <TableCell className="numeric tabular">
                    {formatMoney(line.unitCost, currency)}
                  </TableCell>
                  <TableCell className="numeric tabular">{formatMoney(line.value, currency)}</TableCell>
                  <TableCell className="text-muted-foreground">{line.description ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">
                  Totals
                  {adjustment.status === 'VOID' ? (
                    <Badge variant="destructive" className="ml-2">
                      void
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell colSpan={4} />
                <TableCell className="numeric tabular font-semibold">
                  {formatMoney(totalValue, currency)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      </div>

      <ApprovalTrailPanel entityType="INVENTORY_ADJUSTMENT" entityId={adjustment.id} />

      <DocumentHistory events={history} timeZone={ctx.organization.timeZone} />
    </>
  )
}

function Detail({
  label,
  value,
  href,
}: {
  label: string
  value: string
  href?: string
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium">
          {href ? (
            <Link href={href} className="underline-offset-4 hover:underline">
              {value}
            </Link>
          ) : (
            value
          )}
        </p>
      </CardContent>
    </Card>
  )
}
