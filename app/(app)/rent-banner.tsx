import Link from 'next/link'

import { companyLimitStatus } from '@/lib/company-limits'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getOrgContext } from '@/server/auth/context'

/** Soft notice when trial is ending or rent has ended — points to /billing. */
export async function RentBanner() {
  const ctx = await getOrgContext()
  if (!ctx || ctx.role === 'CUSTOMER') return null

  const status = companyLimitStatus({
    accessRestricted: ctx.organization.accessRestricted,
    rentExpiresAt: ctx.organization.rentExpiresAt,
    maxUsers: ctx.organization.maxUsers,
    rentNote: ctx.organization.rentNote,
  })
  if (status.accessRestricted) return null

  if (status.rentExpired) {
    return (
      <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <p>
            Rent for this company has ended. Pay from Billing to restore full access
            {ctx.role === 'OWNER' || ctx.role === 'ADMIN' || ctx.isSystemOwner
              ? ''
              : ' — ask an owner or admin'}
            .
          </p>
          <Link href="/billing" className={cn(buttonVariants({ size: 'sm' }))}>
            Open Billing
          </Link>
        </div>
      </div>
    )
  }

  if (status.onTrial && status.daysLeft != null && status.daysLeft <= 5) {
    return (
      <div className="border-b border-border bg-muted/60 px-4 py-2 text-sm text-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <p>
            Free trial ends in {status.daysLeft} day{status.daysLeft === 1 ? '' : 's'}. Choose a plan
            and submit payment proof when you are ready.
          </p>
          <Link href="/billing" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
            Billing
          </Link>
        </div>
      </div>
    )
  }

  return null
}
