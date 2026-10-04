import type { Metadata } from 'next'
import { DownloadIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Backup' }

export default async function BackupPage() {
  const ctx = await requireOrgContext('org:update')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Backup</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Downloads a copy of {ctx.organization.name}: the accounts, customers, vendors, items,
          invoices, bills, payments, and journals. Take one whenever you want to keep a copy.
          Passwords are not included.
        </p>
      </div>
      <a href="/api/backup" className={buttonVariants()}>
        <DownloadIcon />
        Download backup
      </a>
    </div>
  )
}
