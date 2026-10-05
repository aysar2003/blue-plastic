import type { Metadata } from 'next'
import Link from 'next/link'

import { requireOrgContext } from '@/server/auth/context'
import * as posService from '@/server/services/pos.service'

export const metadata: Metadata = { title: 'Point of Sale' }

export default async function PosHomePage() {
  const ctx = await requireOrgContext('pos:read')
  const registers = await posService.listRegisters(ctx)
  const canManage = ctx.permissions.has('pos:manage')

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-[#714B67]">Point of Sale</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dooro qalabka iibka (register). Haddii aadan haysan mid,{' '}
        {canManage ? (
          <Link href="/pos/settings" className="text-[#017e84] underline">
            samee POS settings
          </Link>
        ) : (
          'weydii maamulaha inuu kuu diyaariyo POS settings'
        )}
        .
      </p>
      <ul className="mt-8 space-y-3">
        {registers.map((register) => (
          <li key={register.id}>
            <Link
              href={`/pos/${register.id}`}
              className="flex items-center justify-between rounded-xl border bg-card px-5 py-4 shadow-sm transition hover:border-[#714B67]/40"
            >
              <span className="font-medium">{register.name}</span>
              {register.store ? (
                <span className="text-sm text-muted-foreground">{register.store.name}</span>
              ) : null}
            </Link>
          </li>
        ))}
        {registers.length === 0 ? (
          <li className="rounded-xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
            No active registers.
          </li>
        ) : null}
      </ul>
    </div>
  )
}
