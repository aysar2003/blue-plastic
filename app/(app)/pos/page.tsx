import type { Metadata } from 'next'

import { PosDashboard } from '@/components/pos/pos-dashboard'
import { requireOrgContext } from '@/server/auth/context'
import * as posService from '@/server/services/pos.service'

export const metadata: Metadata = { title: 'Point of Sale' }

type Props = { searchParams: Promise<{ open?: string }> }

export default async function PosHomePage({ searchParams }: Props) {
  const ctx = await requireOrgContext('pos:read')
  const { open } = await searchParams
  const registers = await posService.dashboardRegisters(ctx)
  const canManage = ctx.permissions.has('pos:manage')
  const canTransfer = canManage || ctx.permissions.has('pos:sell')
  const transferDestinations = canTransfer ? await posService.registerTransferDestinations(ctx) : []
  const orgInitial = (ctx.organization.name.trim()[0] ?? 'P').toUpperCase()

  return (
    <PosDashboard
      registers={registers}
      currency={ctx.organization.baseCurrency}
      canManage={canManage}
      canTransfer={canTransfer}
      transferDestinations={transferDestinations}
      orgInitial={orgInitial}
      initialOpenRegisterId={open && registers.some((row) => row.id === open) ? open : null}
    />
  )
}
