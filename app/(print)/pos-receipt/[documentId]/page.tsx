import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ThermalReceipt } from '@/components/pos/thermal-receipt'
import { CREATOR_BRAND_NAME } from '@/lib/feature-flags'
import { parseChange } from '@/lib/pos-receipt'
import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'
import * as posService from '@/server/services/pos.service'

export const metadata: Metadata = { title: 'Receipt' }

type Props = {
  params: Promise<{ documentId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * The till slip for a POS sale, on 80mm / 58mm thermal roll. Outside the app
 * shell so only the slip prints. The A4 sheet at /sales/sales-receipts/[id]/print
 * is unchanged for everything else.
 */
export default async function PosReceiptPage({ params, searchParams }: Props) {
  const [{ documentId }, query] = await Promise.all([params, searchParams])
  const ctx = await requireOrgContext('pos:read')
  const [receipt, organization] = await Promise.all([
    posService.receipt(ctx, documentId).catch(() => null),
    organizationService.get(ctx),
  ])
  if (!receipt) notFound()

  const addressLines = [
    [organization.addressLine1, organization.addressLine2].filter(Boolean).join(', '),
    [organization.city, organization.region].filter(Boolean).join(', '),
    organization.country,
  ].filter((line): line is string => Boolean(line))

  return (
    <ThermalReceipt
      receipt={{ ...receipt, createdAt: receipt.createdAt.toISOString() }}
      shop={{
        name: organization.name,
        addressLines,
        phone: organization.phone,
        taxRegistrationNumber: organization.taxRegistrationNumber,
        timeZone: organization.timeZone || 'UTC',
      }}
      change={
        Number(receipt.change) > 0.004 ? Math.round(Number(receipt.change) * 100) / 100 : parseChange(query.change)
      }
      autoprint={query.autoprint === '1'}
      creatorBrand={ctx.features.showCreatorBrand ? CREATOR_BRAND_NAME : null}
    />
  )
}
