import type { Metadata } from 'next'
import Link from 'next/link'

import { BooksTabs } from '@/components/accounts/books-tabs'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Recurring transactions' }

export default function RecurringPage() {
  return (
    <>
      <BooksTabs active="recurring" />
      <PageHeader
        title="Recurring transactions"
        description="These books do not store a repeating schedule. Enter the next bill or journal when it is due — each one stays a record of its own."
      />
      <Card>
        <CardContent className="flex flex-wrap gap-2 pt-6">
          <Link href="/purchases/bills/new" className={buttonVariants({ size: 'sm' })}>
            New bill
          </Link>
          <Link href="/journals/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            New journal entry
          </Link>
          <Link href="/purchases/expenses/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            New expense
          </Link>
        </CardContent>
      </Card>
    </>
  )
}
