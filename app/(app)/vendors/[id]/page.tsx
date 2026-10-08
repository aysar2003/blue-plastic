import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { FilterChips } from '@/components/data/filter-chips'
import { RecordedBy } from '@/components/data/recorded-by'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ContactDetail } from '@/components/master-data/contact-detail'
import { VendorActions } from '@/components/vendors/vendor-actions'
import { formatDate, today } from '@/lib/date'
import { DATE_PRESETS, presetRange, readDatePreset } from '@/lib/list-filters'
import { describeTerm } from '@/lib/payment-terms'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { requireOrgContext } from '@/server/auth/context'
import { trailFor } from '@/server/services/audit.service'
import * as contactService from '@/server/services/contact.service'
import { vendorActivity } from '@/server/services/vendor-activity'

export const metadata: Metadata = { title: 'Vendor' }

export default async function VendorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('vendor:read')
  const { id } = await params
  const search = await searchParams

  const vendor = await contactService.getVendor(ctx, id).catch(() => null)
  if (!vendor) notFound()

  const currency = ctx.organization.baseCurrency
  const [activity, trail] = await Promise.all([vendorActivity(ctx, id), trailFor(ctx, id)])
  const asOf = today(ctx.organization.timeZone)
  const tx = typeof search.tx === 'string' ? search.tx : ''
  const datePreset = readDatePreset(search.date)
  const range = presetRange(datePreset, asOf)
  const kinds = [...new Set(activity.map((row) => row.kind))]
  const shown = activity.filter((row) => {
    if (tx && row.kind !== tx) return false
    if (range && (row.date < range.from || row.date > range.to)) return false
    return true
  })
  const activityParams = { date: datePreset || undefined, tx: tx || undefined }
  const canBill = ctx.permissions.has('bill:create')
  const canPay = ctx.permissions.has('expense:create')
  const canReport = ctx.permissions.has('report:read')

  return (
    <>

      <PageHeader
        title={vendor.displayName}
        description={vendor.companyName ?? undefined}
        actions={
          <>
            {!vendor.isActive ? <Badge variant="outline">archived</Badge> : null}
            <VendorActions
              vendorId={vendor.id}
              contact={vendor}
              terms={[]}
              today={today(ctx.organization.timeZone)}
              currency={currency}
              canBill={canBill}
              canPay={canPay}
              canReport={canReport}
              canEdit={ctx.permissions.has('vendor:update')}
              canArchive={ctx.permissions.has('vendor:archive')}
              canDelete={ctx.features.allowContactDelete && ctx.permissions.has('vendor:archive')}
              isActive={vendor.isActive}
            />
          </>
        }
      />

      <RecordedBy trail={trail} timeZone={ctx.organization.timeZone} />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">You owe</p>
            <p className="tabular mt-0.5 text-lg font-semibold">{formatMoney(vendor.balance, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Payment terms</p>
            <p className="mt-0.5 text-sm font-medium">
              {vendor.paymentTerm ? describeTerm(vendor.paymentTerm) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Default expense account</p>
            <p className="mt-0.5 text-sm font-medium">
              {vendor.defaultExpenseAccount
                ? `${vendor.defaultExpenseAccount.code} ${vendor.defaultExpenseAccount.name}`
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <ContactDetail contact={vendor} side="vendor" />

      <div className="mt-4 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-2 border-b px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">Transactions</h3>
            <p className="text-xs text-muted-foreground">Open a row to see that bill, payment, or journal.</p>
          </div>
          <FilterChips
            options={[...DATE_PRESETS]}
            active={datePreset}
            path={`/vendors/${vendor.id}`}
            param="date"
            params={activityParams}
          />
          <FilterChips
            options={[{ value: '', label: 'All types' }, ...kinds.map((kind) => ({ value: kind, label: kind }))]}
            active={kinds.includes(tx) ? tx : ''}
            path={`/vendors/${vendor.id}`}
            param="tx"
            params={activityParams}
          />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[40rem]">
            <div className="band-head grid grid-cols-[7.5rem_6.5rem_7.5rem_minmax(0,1fr)_8rem] px-3 py-2 text-xs font-medium uppercase tracking-wide">
              <span>Type</span>
              <span>Num</span>
              <span>Date</span>
              <span>Account</span>
              <span className="text-right">Amount</span>
            </div>
            {shown.map((row, index) => (
              <Link
                key={`${row.kind}-${row.id}`}
                href={row.href}
                className={cn(
                  'grid grid-cols-[7.5rem_6.5rem_7.5rem_minmax(0,1fr)_8rem] items-center px-3 py-2 text-sm hover:bg-[#d7ebf6]',
                  index % 2 === 0 ? 'bg-card' : 'band-alt',
                )}
              >
                <span>{row.kind}</span>
                <span className="font-medium">{row.number}</span>
                <span className="tabular text-muted-foreground">{formatDate(row.date)}</span>
                <span className="truncate text-muted-foreground">{row.account ?? '—'}</span>
                <span className="tabular text-right">{formatMoney(row.amount, currency)}</span>
              </Link>
            ))}
            {shown.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                {activity.length === 0 ? 'No transactions for this vendor yet.' : 'Nothing in this date or type.'}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
