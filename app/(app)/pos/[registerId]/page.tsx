import type { Metadata } from 'next'

import { PosTerminal } from '@/components/pos/pos-terminal'
import { requireOrgContext } from '@/server/auth/context'
import * as posService from '@/server/services/pos.service'

export const metadata: Metadata = { title: 'Till' }

type Props = { params: Promise<{ registerId: string }> }

export default async function PosRegisterPage({ params }: Props) {
  const { registerId } = await params
  const ctx = await requireOrgContext('pos:sell')
  const register = await posService.registerForTerminal(ctx, registerId)
  const products = await posService.catalog(ctx, register.storeId)

  return (
    <PosTerminal
      register={{
        id: register.id,
        name: register.name,
        paymentMethods: register.paymentMethods.map((method) => ({
          id: method.id,
          name: method.name,
        })),
      }}
      products={products}
      currency={ctx.organization.baseCurrency}
      orgName={ctx.organization.name}
    />
  )
}
