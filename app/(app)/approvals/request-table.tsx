import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { approvalDocumentLinks } from '@/lib/approval-links'
import { entityTypeLabel } from '@/lib/approval-labels'
import { formatDateTime } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

import { ApprovalDecideButtons } from './decide-buttons'

export type ApprovalRow = {
  id: string
  title: string
  href: string
  entityId: string
  entityType: Parameters<typeof entityTypeLabel>[0]
  amount: { toString(): string } | null
  currencyCode: string | null
  submittedAt: Date
  decidedAt: Date | null
  submittedBy: { name: string }
  submittedById: string
  createdBy: string | null
  currentLevel: number
  requiredLevels: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  canDecide: boolean
  canReject: boolean
  decideReason: string | null
  assignedTo: string[]
}

export function ApprovalRequestTable({
  rows,
  timeZone,
  baseCurrency,
  mode,
}: {
  rows: ApprovalRow[]
  timeZone: string
  baseCurrency: string
  mode: 'pending' | 'history'
}) {
  return (
    <Card className="overflow-hidden p-0">
      <ScrollSheet>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Submitted by</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>{mode === 'pending' ? 'When' : 'Decided'}</TableHead>
              {mode === 'history' ? <TableHead>Status</TableHead> : null}
              <TableHead className="print:hidden">Open</TableHead>
              {mode === 'pending' ? (
                <TableHead className="text-right print:hidden">Decide</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const links = approvalDocumentLinks(row.href)
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link href={links.view} className="font-medium text-primary hover:underline">
                      {row.title}
                    </Link>
                    {row.requiredLevels > 1 ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Level {row.currentLevel} of {row.requiredLevels}
                      </span>
                    ) : null}
                    {row.assignedTo.length > 0 ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Assigned: {row.assignedTo.join(', ')}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entityTypeLabel(row.entityType)}
                  </TableCell>
                  <TableCell className="text-sm">{row.createdBy ?? '—'}</TableCell>
                  <TableCell className="text-sm">{row.submittedBy.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.amount != null
                      ? formatMoney(row.amount.toString(), row.currencyCode ?? baseCurrency)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(
                      mode === 'pending' ? row.submittedAt : (row.decidedAt ?? row.submittedAt),
                      timeZone,
                    )}
                  </TableCell>
                  {mode === 'history' ? (
                    <TableCell>
                      <Badge
                        variant={
                          row.status === 'APPROVED'
                            ? 'success'
                            : row.status === 'REJECTED'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {row.status === 'APPROVED'
                          ? 'Approved'
                          : row.status === 'REJECTED'
                            ? 'Rejected'
                            : 'Cancelled'}
                      </Badge>
                    </TableCell>
                  ) : null}
                  <TableCell className="print:hidden">
                    <div className="flex flex-wrap gap-1">
                      <Link
                        href={links.view}
                        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                      >
                        View
                      </Link>
                      {links.edit ? (
                        <Link
                          href={links.edit}
                          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                        >
                          Edit
                        </Link>
                      ) : null}
                      {links.print ? (
                        <Link
                          href={links.print}
                          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                        >
                          Print
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                  {mode === 'pending' ? (
                    <TableCell className="text-right print:hidden">
                      <ApprovalDecideButtons
                        requestId={row.id}
                        canDecide={row.canDecide}
                        canReject={row.canReject}
                        blockedReason={row.decideReason}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </ScrollSheet>
    </Card>
  )
}
