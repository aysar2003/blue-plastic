import type { Metadata } from 'next'
import Link from 'next/link'
import { ListFilterIcon } from 'lucide-react'

import { BooksTabs } from '@/components/accounts/books-tabs'
import { BankRuleList } from '@/components/banking/bank-rule-list'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
          <BankRuleList
            canManage={ctx.permissions.has('bank:import')}
            rules={rules.map((rule) => ({
              id: rule.id,
              name: rule.name,
              contains: rule.contains,
              active: rule.active,
              bank: rule.account?.name ?? 'Every bank',
              category: `${rule.categoryAccount.code} ${rule.categoryAccount.name}`,
              payee: rule.vendor?.displayName ?? '—',
            }))}
          />
        </Card>
      )}
    </>
  )
}
