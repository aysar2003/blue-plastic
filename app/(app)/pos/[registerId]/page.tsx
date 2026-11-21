import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { redirect } from 'next/navigation'

import { RegisterPinGate } from '@/components/pos/register-pin-gate'
import { formatMoney } from '@/lib/money'
import { formatDateTime } from '@/lib/date'
import { preferredPaymentMethodId } from '@/lib/pos-payment'
import { requireOrgContext } from '@/server/auth/context'
import { registerUnlockMatches } from '@/server/pos/cashier-unlock'
import * as posService from '@/server/services/pos.service'
import { listForPicker as listProjects } from '@/server/services/project.service'

const PosTerminal = dynamic(() =>
  import('@/components/pos/pos-terminal').then((m) => ({ default: m.PosTerminal })),
)

export const metadata: Metadata = { title: 'Till' }

type Props = { params: Promise<{ registerId: string }> }

export default async function PosRegisterPage({ params }: Props) {
  const { registerId } = await params
  const ctx = await requireOrgContext('pos:sell')
  if (!(await posService.mayUseRegister(ctx, registerId))) redirect('/pos')

  // Session open + PIN state + register payload in parallel after access check.
  const [session, pin, register] = await Promise.all([
    posService.openSessionForRegister(ctx, registerId),
    posService.registerPinState(ctx, registerId),
    posService.registerForTerminal(ctx, registerId),
  ])
  if (!session) redirect(`/pos?open=${registerId}`)

  if (pin.hasPin && !(await registerUnlockMatches(ctx.orgId, registerId))) {
    return <RegisterPinGate registerId={pin.id} registerName={pin.name} />
  }

  // The register decides which store's stock the cart warns about.
  const canCreateQuote = ctx.permissions.has('invoice:create')
  const canReadQuote = ctx.permissions.has('invoice:read')
  const canQuote = canCreateQuote || canReadQuote
  const [catalog, customers, cashSummary, recentOrders, useCounts, openQuotations, tillBank, transferDestinations, projects] =
    await Promise.all([
    posService.catalog(ctx, register.storeId),
    posService.walkInCustomers(ctx),
    posService.sessionCashSummary(ctx, session.id),
    posService.recentSessionOrders(ctx, session.id),
    posService.paymentMethodUseCounts(ctx, registerId),
    canReadQuote ? posService.listOpenQuotations(ctx) : Promise.resolve([]),
    posService.registerBankSnapshot(ctx, registerId),
    posService.registerTransferDestinations(ctx),
    listProjects(ctx),
  ])
  const currency = ctx.organization.baseCurrency

  return (
    <PosTerminal
      cashierUserId={ctx.userId}
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
      }}
      cashSummary={{
        expectedCash: cashSummary.expectedCash,
        cashIn: cashSummary.cashIn,
        cashOut: cashSummary.cashOut,
        cashSales: cashSummary.cashSales,
        cashRefunds: cashSummary.cashRefunds,
        sales: cashSummary.sales,
        refunds: cashSummary.refunds,
        netSales: cashSummary.netSales,
      }}
      tillBalance={
        tillBank.balance && tillBank.balanceRaw
          ? { balance: tillBank.balance, balanceRaw: tillBank.balanceRaw }
          : null
      }
      transferDestinations={transferDestinations.filter((account) => account.id !== tillBank.accountId)}
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
      openQuotations={openQuotations}
      canQuote={canQuote}
      canCreateQuote={canCreateQuote}
      products={catalog.products}
      stockStoreName={catalog.storeName}
      stockStoreId={catalog.storeId}
      stores={catalog.stores}
      customers={customers}
      projects={projects.map((project) => ({
        id: project.id,
        label: project.label,
        customerId: project.customerId,
      }))}
      currency={currency}
      orgId={ctx.orgId}
      orgName={ctx.organization.name}
      usualPaymentMethodId={preferredPaymentMethodId(register.paymentMethods, useCounts)}
    />
  )
}
