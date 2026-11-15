import type { Metadata } from 'next'
import Link from 'next/link'

import { setCapaStatusAction } from '@/app/(app)/quality/capa/actions'
import { PageHeader } from '@/components/data/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CAPA_STATUSES, canCloseCapa, isCapaStatus, type CapaStatus } from '@/lib/erp/capa'
import { requireOrgContext } from '@/server/auth/context'
import * as capaService from '@/server/services/capa.service'

export const metadata: Metadata = { title: 'CAPA' }

type Props = { searchParams: Promise<{ status?: string }> }

export default async function CapaPage({ searchParams }: Props) {
  const query = await searchParams
  const statusFilter = isCapaStatus(query.status ?? '') ? (query.status as CapaStatus) : undefined
  const ctx = await requireOrgContext('audit:read')
  const rows = await capaService.list(ctx, statusFilter ? { status: statusFilter } : undefined)
  const canEdit = ctx.permissions.has('docs:update')

  return (
    <>
      <PageHeader
        title="CAPA"
        description="Corrective and preventive action notes — optional links to workspace files or sign requests."
        actions={
          ctx.permissions.has('docs:create') ? (
            <Link href="/quality/capa/new" className={buttonVariants({ size: 'sm' })}>
              New CAPA
            </Link>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/quality/capa"
          className={buttonVariants({
            variant: statusFilter === undefined ? 'default' : 'outline',
            size: 'sm',
          })}
        >
          All
        </Link>
        {CAPA_STATUSES.map((status) => (
          <Link
            key={status}
            href={`/quality/capa?status=${status}`}
            className={buttonVariants({
              variant: statusFilter === status ? 'default' : 'outline',
              size: 'sm',
            })}
          >
            {status.replace('_', ' ')}
          </Link>
        ))}
      </div>

      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
            <Link href={`/quality/capa/${row.id}`} className="font-medium text-primary hover:underline">
              {row.number}
            </Link>
            <span>
              {row.title} · {row.status}
            </span>
            {canEdit && row.status === 'OPEN' ? (
              <form action={setCapaStatusAction}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="status" value="IN_PROGRESS" />
                <Button type="submit" size="sm" variant="outline">
                  Start
                </Button>
              </form>
            ) : null}
            {canEdit && canCloseCapa(row.status as CapaStatus) && row.status !== 'CLOSED' ? (
              <Link
                href={`/quality/capa/${row.id}?close=1`}
                className={buttonVariants({ size: 'sm', variant: 'secondary' })}
              >
                Close…
              </Link>
            ) : null}
          </li>
        ))}
        {rows.length === 0 ? <Card className="px-4 py-8 text-muted-foreground">No CAPA notes yet.</Card> : null}
      </ul>
    </>
  )
}