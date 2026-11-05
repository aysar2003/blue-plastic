import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'
import * as dashboardBoard from '@/server/services/dashboard-board.service'

import { deleteDashboard } from '../actions'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardBoardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext('report:overview')
  const { id } = await params
  let board
  try {
    board = await dashboardBoard.resolveBoard(ctx, id)
  } catch {
    notFound()
  }
  const canEdit = ctx.permissions.has('report:export')

  return (
    <>
      <PageHeader
        title={board.name}
        description={board.description ?? 'Tiles from existing KPIs and reports.'}
        actions={
          <div className="flex gap-2">
            <Link href="/reports/dashboards" className={buttonVariants({ size: 'sm', variant: 'secondary' })}>
              All dashboards
            </Link>
            {canEdit ? (
              <form action={deleteDashboard}>
                <input type="hidden" name="id" value={board.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Delete
                </Button>
              </form>
            ) : null}
          </div>
        }
      />

      {board.banners.length > 0 ? (
        <div className="mb-4 space-y-2">
          {board.banners.map((text) => (
            <p key={text} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {text}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {board.tiles.map((tile) => (
          <Card key={`${tile.kind}-${tile.refKey}-${tile.title}`} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{tile.kind}</p>
            <p className="mt-1 font-medium">{tile.title}</p>
            <p className="mt-2 text-2xl tabular-nums">
              {tile.href ? (
                <Link href={tile.href} className="text-primary hover:underline">
                  {tile.value ?? '—'}
                </Link>
              ) : (
                (tile.value ?? '—')
              )}
            </p>
          </Card>
        ))}
      </div>
    </>
  )
}
