import type { Metadata } from 'next'

import { RegisterLockPage } from '@/components/pos/register-lock-page'
import { requireOrgContext } from '@/server/auth/context'
import * as posService from '@/server/services/pos.service'

export const metadata: Metadata = { title: 'Unlock Register' }

type Props = { params: Promise<{ registerId: string }> }

export default async function PosLockPage({ params }: Props) {
  const { registerId } = await params
  const ctx = await requireOrgContext('pos:sell')
  await posService.registerForTerminal(ctx, registerId)

  return <RegisterLockPage orgName={ctx.organization.name} registerId={registerId} />
}
