import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangleIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'
import * as systemAccounts from '@/server/services/system-accounts.service'
import { SystemAccountRow } from './system-account-row'

export const metadata: Metadata = { title: 'Default accounts' }

/**
 * Where the system posts.
 *
 * The engine never names an account. It asks for a *role* — the receivable
 * control account, the account uncategorised income lands in — and this screen
 * is where a role is bound to an account. Every invoice, bill, payment and
 * closing entry resolves through these bindings, which is why changing one here
 * changes what every form does without any form knowing about it.
 */
export default async function DefaultAccountsPage() {
  const ctx = await requireOrgContext('account:read')
  const bindings = await systemAccounts.list(ctx)
  const canEdit = ctx.permissions.has('account:update')

  const unset = bindings.filter((binding) => !binding.account)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Default accounts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The system does not name accounts — it asks for a role, and these are the accounts those roles
          point at. An invoice debits whatever is set as receivables here; a bill line with no category
          lands in whatever is set as uncategorised expense. Change one and every form follows.
        </p>
      </div>

      {unset.length > 0 ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-destructive">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            <span>
              {unset.length} {unset.length === 1 ? 'role has' : 'roles have'} no account. Anything that needs{' '}
              {unset.length === 1 ? 'it' : 'them'} will refuse to post until{' '}
              {unset.length === 1 ? 'it is' : 'they are'} set.
            </span>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="divide-y">
          {bindings.map((binding) => (
            <SystemAccountRow key={binding.role.key} binding={binding} canEdit={canEdit} />
          ))}
        </div>
      </Card>

      <p className="text-sm text-muted-foreground">
        Rebinding a role does not move a balance. Entries already posted stay on the account that received
        them — the ledger records what happened, and it is not rewritten to match a later preference. To
        clear an account you have moved away from, post a journal entry for it. Add or rename accounts in
        the{' '}
        <Link href="/accounts" className="underline underline-offset-4">
          chart of accounts
        </Link>
        .
      </p>
    </div>
  )
}
