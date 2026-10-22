import Link from 'next/link'

import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { LinkedParty } from '@/server/services/contact.service'

/**
 * Shows the other half of a customer ↔ supplier pair on contact pages and
 * statements, with balances and a way into their books.
 */
export function LinkedPartyCard({
  party,
  ownBalance,
  currency,
  className,
}: {
  party: LinkedParty
  /** This contact's own AR or AP balance, for a simple net figure. */
  ownBalance: string
  currency: string
  className?: string
}) {
  const label = party.side === 'vendor' ? 'Linked supplier' : 'Linked customer'
  const ownLabel = party.side === 'vendor' ? 'They owe you' : 'You owe them'
  const otherLabel = party.side === 'vendor' ? 'You owe them' : 'They owe you'
  const own = Number(ownBalance)
  const other = Number(party.balance)
  // Customer AR minus vendor AP: positive = net receivable from the pair.
  const net =
    party.side === 'vendor'
      ? own - other
      : other - own

  return (
    <div
      className={cn(
        'mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm',
        className,
      )}
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-medium">
        <Link href={party.href} className="text-primary underline-offset-4 hover:underline">
          {party.displayName}
        </Link>
        {!party.isActive ? (
          <span className="ml-2 text-xs text-muted-foreground">(archived)</span>
        ) : null}
      </p>
      <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
        <div>
          <dt>{ownLabel}</dt>
          <dd className="tabular font-medium text-foreground">{formatMoney(ownBalance, currency)}</dd>
        </div>
        <div>
          <dt>{otherLabel}</dt>
          <dd className="tabular font-medium text-foreground">
            {formatMoney(party.balance, currency)}
          </dd>
        </div>
        <div>
          <dt>Net position</dt>
          <dd className="tabular font-medium text-foreground">
            {formatMoney(net.toFixed(2), currency)}
          </dd>
        </div>
      </dl>
      <p className="mt-2">
        <Link
          href={party.statementHref}
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Open {party.side === 'vendor' ? 'supplier' : 'customer'} statement
        </Link>
      </p>
    </div>
  )
}
