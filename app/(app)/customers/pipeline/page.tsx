import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { CRM_ACTIVITY_KINDS, CRM_STAGES, isOpenOpportunity } from '@/lib/erp/crm-pipeline'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as crm from '@/server/services/crm.service'

import { completeActivity, createOpportunity, logActivity, moveOpportunity } from './actions'

export const metadata: Metadata = { title: 'Pipeline' }

const NEXT: Record<string, string | null> = {
  LEAD: 'QUALIFIED',
  QUALIFIED: 'PROPOSAL',
  PROPOSAL: 'WON',
  WON: null,
  LOST: 'LEAD',
}

export default async function CustomerPipelinePage() {
  const ctx = await requireOrgContext('customer:read')
  const board = await crm.listBoard(ctx)
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Sales pipeline"
        description="Opportunities and follow-ups on customers — Lead → Qualified → Proposal → Won."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/customers">Customers</Link>
          </Button>
        }
      />

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="font-medium">New opportunity</h2>
          <form action={createOpportunity} className="space-y-2">
            <Label>Customer</Label>
            <NativeSelect name="customerId" required>
              {board.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName}
                </option>
              ))}
            </NativeSelect>
            <Input name="title" placeholder="Title" required />
            <Input name="amount" placeholder="Amount" />
            <Input name="expectedClose" type="date" />
            <Button type="submit" size="sm">
              Add
            </Button>
          </form>
        </Card>
        <Card className="space-y-3 p-4">
          <h2 className="font-medium">Follow-up</h2>
          <form action={logActivity} className="space-y-2">
            <NativeSelect name="customerId" required>
              {board.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect name="kind" defaultValue="CALL">
              {CRM_ACTIVITY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </NativeSelect>
            <Input name="subject" placeholder="Subject" required />
            <Input name="dueAt" type="datetime-local" />
            <Button type="submit" size="sm">
              Log activity
            </Button>
          </form>
        </Card>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {CRM_STAGES.map((stage) => (
          <Card key={stage} className="p-3">
            <h3 className="mb-2 text-sm font-semibold">{stage}</h3>
            <ul className="space-y-2 text-sm">
              {board.opportunities
                .filter((row) => row.stage === stage)
                .map((row) => {
                  const next = NEXT[row.stage]
                  return (
                    <li key={row.id} className="rounded-md border px-2 py-1">
                      <div className="font-medium">{row.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {row.customer.displayName}
                        {row.amount ? ` · ${formatMoney(row.amount, currency)}` : ''}
                      </div>
                      {next ? (
                        <form action={moveOpportunity} className="mt-1">
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="stage" value={next} />
                          <Button type="submit" size="sm" variant="secondary">
                            {next === 'LEAD' ? 'Reopen' : `To ${next}`}
                          </Button>
                        </form>
                      ) : null}
                      {isOpenOpportunity(row.stage) ? (
                        <form action={moveOpportunity} className="mt-1">
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="stage" value="LOST" />
                          <Button type="submit" size="sm" variant="ghost">
                            Lost
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  )
                })}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="mb-3 font-medium">Activities</h2>
        <ul className="space-y-2 text-sm">
          {board.activities.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2">
              <span>
                {row.kind} · {row.subject} · {row.customer.displayName}
              </span>
              {row.doneAt ? (
                <span className="text-muted-foreground">done</span>
              ) : (
                <form action={completeActivity}>
                  <input type="hidden" name="id" value={row.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Done
                  </Button>
                </form>
              )}
            </li>
          ))}
          {board.activities.length === 0 ? (
            <li className="text-muted-foreground">No follow-ups yet.</li>
          ) : null}
        </ul>
      </Card>
    </>
  )
}
