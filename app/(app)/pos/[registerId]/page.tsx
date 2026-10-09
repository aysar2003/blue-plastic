import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { PosTerminal } from '@/components/pos/pos-terminal'
import { RegisterPinGate } from '@/components/pos/register-pin-gate'
import { formatMoney } from '@/lib/money'
import { formatDateTime } from '@/lib/date'
import { preferredPaymentMethodId } from '@/lib/pos-payment'
import { requireOrgContext } from '@/server/auth/context'
import { registerUnlockMatches } from '@/server/pos/cashier-unlock'
import * as posService from '@/server/services/pos.service'

export const metadata: Metadata = { title: 'Till' }

type Props = { params: Promise<{ registerId: string }> }

export default async function PosRegisterPage({ params }: Props) {
  const { registerId } = await params
  const ctx = await requireOrgContext('pos:sell')
  const session = await posService.openSessionForRegister(ctx, registerId)
  if (!session) redirect(`/pos?open=${registerId}`)

  const pin = await posService.registerPinState(ctx, registerId)
  if (pin.hasPin && !(await registerUnlockMatches(ctx.orgId, registerId))) {
    return <RegisterPinGate registerId={pin.id} registerName={pin.name} />
  }

  // The register decides which store's stock the cart warns about.
  const register = await posService.registerForTerminal(ctx, registerId)
  const [catalog, customers, cashSummary, recentOrders, useCounts] = await Promise.all([
    posService.catalog(ctx, register.storeId),
    posService.walkInCustomers(ctx),
    posService.sessionCashSummary(ctx, session.id),
    posService.recentSessionOrders(ctx, session.id),
    posService.paymentMethodUseCounts(ctx, registerId),
  ])
  const currency = ctx.organization.baseCurrency
  const orderBadge = session.id.slice(-4).toUpperCase()

  return (
    <PosTerminal
      register={{
        id: register.id,
        name: register.name,
        defaultChangeMethodId: register.defaultChangeMethodId,
        allowWalletChangeReturn: register.allowWalletChangeReturn,
        paymentMethods: register.paymentMethods.map((method) => ({
          id: method.id,
          name: method.name,
          isCash: method.isCash,
          allowsChangeReturn: method.allowsChangeReturn,
        })),
      }}
      session={{
        id: session.id,
        dateLabel: formatDateTime(session.openedAt, ctx.organization.timeZone),
        openingCash: formatMoney(session.openingCash, currency),
        orderBadge,
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
      usualPaymentMethodId={preferredPaymentMethodId(register.paymentMethods, useCounts)}
    />
  )
}
