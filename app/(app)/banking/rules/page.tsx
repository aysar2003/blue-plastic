import type { Metadata } from 'next'
import Link from 'next/link'
import { ListFilterIcon } from 'lucide-react'

import { BooksTabs } from '@/components/accounts/books-tabs'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export const metadata: Metadata = { title: 'Bank rules' }

export default async function BankRulesPage() {
  const ctx = await requireOrgContext('bank:read')
  const rules = await db.bankRule.findMany({
    where: { orgId: ctx.orgId },
    select: {
      id: true,
      name: true,
      contains: true,
      active: true,
      account: { select: { name: true } },
      categoryAccount: { select: { code: true, name: true } },
      vendor: { select: { displayName: true } },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <>
      <BooksTabs active="rules" />
      <PageHeader
        title="Rules"
        description="When an imported bank line contains the text, the feed suggests this category and payee. Rules are saved from the statement screen."
        actions={
          ctx.permissions.has('bank:import') ? (
            <Link href="/banking/import" className={buttonVariants({ size: 'sm' })}>
              Open statement
            </Link>
          ) : undefined
        }
      />
      {rules.length === 0 ? (
        <EmptyState
          icon={ListFilterIcon}
          title="No rules yet"
          description="Import a statement and save a rule from a line. It will be listed here."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contains</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{rule.contains}</TableCell>
                  <TableCell className="text-muted-foreground">{rule.account?.name ?? 'Every bank'}</TableCell>
                  <TableCell>
                    {rule.categoryAccount.code} {rule.categoryAccount.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{rule.vendor?.displayName ?? '—'}</TableCell>
                  <TableCell>{rule.active ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  )
}
