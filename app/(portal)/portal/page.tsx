import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { requirePortalContext } from '@/server/auth/context'
import * as portalService from '@/server/services/portal.service'

export const metadata: Metadata = { title: 'Portal' }

export default async function PortalHomePage() {
  const ctx = await requirePortalContext()
  const dash = await portalService.dashboard(ctx)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {dash.customer.companyName || dash.customer.displayName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your account with {ctx.organization.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{dash.balanceTitle}</CardDescription>
            <CardTitle
              className={cn(
                'tabular text-2xl tracking-tight',
                dash.balanceSide === 'debit' && 'text-foreground',
                dash.balanceSide === 'credit' && 'text-emerald-700 dark:text-emerald-400',
              )}
            >
              {dash.balanceLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{dash.balanceExplanation}</p>
            <dl className="grid grid-cols-2 gap-2 border-t pt-2 text-xs">
              <div>
                <dt className="font-medium text-foreground">Debit</dt>
                <dd className="tabular">{dash.balanceDebitLabel}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Credit</dt>
                <dd className="tabular">{dash.balanceCreditLabel}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="tabular text-2xl tracking-tight text-[var(--warning,#d4652f)]">
              {dash.overdueLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {dash.overdueCount} {dash.overdueCount === 1 ? 'invoice' : 'invoices'} past due
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open (not overdue)</CardDescription>
            <CardTitle className="tabular text-2xl tracking-tight">{dash.openLabel}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {dash.openCount} {dash.openCount === 1 ? 'invoice' : 'invoices'} still open
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/portal/invoices" className={cn(buttonVariants())}>
          View invoices
        </Link>
        <Link href="/portal/payments" className={cn(buttonVariants({ variant: 'outline' }))}>
          Payment history
        </Link>
        <Link href="/portal/statement" className={cn(buttonVariants({ variant: 'outline' }))}>
          Statements &amp; reports
        </Link>
      </div>
    </div>
  )
}
