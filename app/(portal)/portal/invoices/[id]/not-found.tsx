import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Portal invoice missing, voided, or not this customer's. */
export default function PortalInvoiceNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 py-16">
      <p className="text-sm font-medium text-muted-foreground">Invoice</p>
      <h1 className="text-2xl font-semibold tracking-tight">This invoice is not available</h1>
      <p className="text-sm text-muted-foreground">
        It may have been removed, voided, or it does not belong to this account. Go back to your
        invoice list and open one that is still there.
      </p>
      <Link href="/portal/invoices" className={cn(buttonVariants())}>
        Back to invoices
      </Link>
    </div>
  )
}
