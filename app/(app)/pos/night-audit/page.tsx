import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as nightAudit from '@/server/services/night-audit.service'

import { closeNightAudit, payoutNightTips } from './actions'

export const metadata: Metadata = { title: 'Night audit' }

export default async function NightAuditPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>
}) {
  const ctx = await requireOrgContext('pos:read')
  const params = searchParams ? await searchParams : {}
  const businessDate = params.date || nightAudit.defaultBusinessDate(ctx.organization.timeZone)
  const preview = await nightAudit.preview(ctx, businessDate)
  const runs = await nightAudit.listRuns(ctx)
  const canClose = ctx.permissions.has('pos:manage')
  const bankAccounts = canClose
    ? await db.ledgerAccount.findMany({
        where: {
          orgId: ctx.orgId,
          isActive: true,
          type: 'ASSET',
          OR: [
            { subtype: 'BANK' },
            { subtype: 'OTHER_CURRENT_ASSET' },
            { detailType: { contains: 'Cash', mode: 'insensitive' } },
          ],
        },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
        take: 80,
      })
    : []

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader
        title="Night audit"
        description="End-of-day POS close: sales, tips, and session cash. Close sessions first."
      />

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="date">Business date</Label>
          <Input id="date" name="date" type="date" defaultValue={businessDate} />
        </div>
        <Button type="submit" variant="secondary">
          Preview
        </Button>
      </form>

      <div className="rounded-lg border border-border p-4 text-sm">
        <p>
          Orders: <strong>{preview.orderCount}</strong> · Sales:{' '}
          <strong>{preview.salesTotal}</strong> · Tips: <strong>{preview.tipsTotal}</strong> ·
          Voided: <strong>{preview.voided}</strong>
        </p>
        <ul className="mt-3 space-y-1 text-muted-foreground">
          {preview.sessions.map((session) => (
            <li key={session.id}>
              {session.register} · {session.status}
              {session.difference != null ? ` · diff ${session.difference}` : ''}
            </li>
          ))}
          {preview.sessions.length === 0 ? <li>No sessions that day.</li> : null}
        </ul>
      </div>

      {canClose ? (
        <form action={closeNightAudit} className="space-y-3 rounded-lg border border-border p-4">
          <input type="hidden" name="businessDate" value={businessDate} />
          <div className="space-y-1">
            <Label htmlFor="memo">Memo</Label>
            <Input id="memo" name="memo" placeholder="Optional note" />
          </div>
          <Button type="submit">Close night audit</Button>
        </form>
      ) : null}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Recent closes</h2>
        <ul className="space-y-3 text-sm text-muted-foreground">
          {runs.map((run) => {
            const tips =
              run.summary &&
              typeof run.summary === 'object' &&
              'tipsTotal' in run.summary
                ? String((run.summary as { tipsTotal?: string }).tipsTotal ?? '0')
                : '0'
            return (
              <li key={run.id} className="rounded-md border border-border p-3">
                <p>
                  {run.businessDate.toISOString().slice(0, 10)} · {run.status} · tips {tips}
                  {run.tipPayoutAt ? ' · paid out' : ''}
                </p>
                {canClose && !run.tipPayoutJournalId && Number(tips) > 0 ? (
                  <form action={payoutNightTips} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="nightAuditId" value={run.id} />
                    <input type="hidden" name="amount" value={tips} />
                    <div className="space-y-1">
                      <Label htmlFor={`bank-${run.id}`}>Pay tips from</Label>
                      <select
                        id={`bank-${run.id}`}
                        name="bankAccountId"
                        required
                        className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                      >
                        {bankAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button type="submit" variant="secondary" disabled={bankAccounts.length === 0}>
                      Pay out tips
                    </Button>
                  </form>
                ) : null}
              </li>
            )
          })}
          {runs.length === 0 ? <li>None yet.</li> : null}
        </ul>
      </div>
    </div>
  )
}