import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { PosTerminal } from '@/components/pos/pos-terminal'
import { formatMoney } from '@/lib/money'
import { formatDateTime } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as posService from '@/server/services/pos.service'

export const metadata: Metadata = { title: 'Till' }

type Props = { params: Promise<{ registerId: string }> }

export default async function PosRegisterPage({ params }: Props) {
  const { registerId } = await params
  const ctx = await requireOrgContext('pos:sell')
  const session = await posService.openSessionForRegister(ctx, registerId)
  if (!session) redirect(`/pos?open=${registerId}`)

  // The register decides which store's stock the cart warns about.
  const register = await posService.registerForTerminal(ctx, registerId)
  const [catalog, customers, cashSummary, recentOrders] = await Promise.all([
    posService.catalog(ctx, register.storeId),
    posService.walkInCustomers(ctx),
    posService.sessionCashSummary(ctx, session.id),
    posService.recentSessionOrders(ctx, session.id),
  ])
  const currency = ctx.organization.baseCurrency

  return (
    <PosTerminal
      cashierUserId={ctx.userId}
      register={{
        id: register.id,
        name: register.name,
        paymentMethods: register.paymentMethods.map((method) => ({
          id: method.id,
          name: method.name,
          isCash: method.isCash,
        })),
      }}
      session={{
        id: session.id,
        dateLabel: formatDateTime(session.openedAt, ctx.organization.timeZone),
        openingCash: formatMoney(session.openingCash, currency),
      }}
      cashSummary={{
        expectedCash: cashSummary.expectedCash,
        cashIn: cashSummary.cashIn,
        cashOut: cashSummary.cashOut,
        cashSales: cashSummary.cashSales,
        cashRefunds: cashSummary.cashRefunds,
      }}
      recentOrders={recentOrders.map((order) => ({
        id: order.id,
        documentId: order.documentId,
        number: order.number,
        total: order.total,
        totalRaw: order.totalRaw,
        customerName: order.customerName,
        dateLabel: order.dateLabel,
        payments: order.payments,
      }))}
      products={catalog.products}
      stockStoreName={catalog.storeName}
      stockStoreId={catalog.storeId}
      stores={catalog.stores}
      customers={customers}
      currency={currency}
      orgName={ctx.organization.name}
    />
  )
}
