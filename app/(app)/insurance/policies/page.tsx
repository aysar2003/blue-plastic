import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, today } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as insurance from '@/server/services/insurance.service'

import { createPolicy, createPremiumRecurringAction, registerClaim } from './actions'

export const metadata: Metadata = { title: 'Insurance policies' }

export default async function InsurancePoliciesPage() {
  const ctx = await requireOrgContext('customer:read')
  const policies = await insurance.listPolicies(ctx)
  const currency = ctx.organization.baseCurrency
  const todayStr = today(ctx.organization.timeZone)

  return (
    <>
      <PageHeader title="Insurance policies" description="Policy register with optional recurring template link." />

      <form action={createPolicy} className="mb-8 grid max-w-lg gap-2 rounded-md border p-4">
        <p className="text-sm font-medium">New policy</p>
        <h2 className="sr-only">Policy details</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor="customerId">Customer id</Label>
            <Input id="customerId" name="customerId" required />
          </div>
          <div>
            <Label htmlFor="policyNumber">Policy #</Label>
            <Input id="policyNumber" name="policyNumber" required />
          </div>
          <div>
            <Label htmlFor="premium">Premium</Label>
            <Input id="premium" name="premium" defaultValue="0" />
          </div>
          <div>
            <Label htmlFor="recurringTemplateId">Recurring template id</Label>
            <Input id="recurringTemplateId" name="recurringTemplateId" />
          </div>
          <div>
            <Label htmlFor="startDate">Start</Label>
            <Input id="startDate" name="startDate" type="date" defaultValue={todayStr} />
          </div>
          <div>
            <Label htmlFor="endDate">End</Label>
            <Input id="endDate" name="endDate" type="date" />
          </div>
          <div>
            <Label htmlFor="coverStart">Cover start</Label>
            <Input id="coverStart" name="coverStart" type="date" defaultValue={todayStr} />
          </div>
          <div>
            <Label htmlFor="coverEnd">Cover end</Label>
            <Input id="coverEnd" name="coverEnd" type="date" />
          </div>
        </div>
        <Button type="submit" size="sm">
          Save policy
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Policy</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Premium</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cover</TableHead>
            <TableHead>Ends</TableHead>
            <TableHead>Recurring</TableHead>
            <TableHead>Claim</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {policies.map((row: (typeof policies)[number]) => (
            <TableRow key={row.id}>
              <TableCell>{row.policyNumber}</TableCell>
              <TableCell>{row.customer.displayName}</TableCell>
              <TableCell className="text-right">{formatMoney(row.premium.toString(), currency)}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>
                {formatDate(row.coverStart.toISOString().slice(0, 10))} –{' '}
                {formatDate(row.coverEnd.toISOString().slice(0, 10))}
              </TableCell>
              <TableCell>{formatDate(row.endDate.toISOString().slice(0, 10))}</TableCell>
              <TableCell>
                {row.recurringTemplate ? (
                  <span className="text-muted-foreground">{row.recurringTemplate.name}</span>
                ) : ctx.permissions.has('invoice:create') ? (
                  <form action={createPremiumRecurringAction}>
                    <input type="hidden" name="policyId" value={row.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Bill recurring
                    </Button>
                  </form>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>
                {ctx.permissions.has('customer:create') ? (
                  <form action={registerClaim} className="flex flex-wrap gap-1">
                    <input type="hidden" name="policyId" value={row.id} />
                    <Input name="amount" placeholder="Amount" className="h-8 w-20" required />
                    <Input name="payer" placeholder="Payer" className="h-8 w-24" />
                    <Input name="claimedOn" type="date" defaultValue={todayStr} className="h-8 w-36" required />
                    <Button type="submit" size="sm" variant="outline">
                      Claim
                    </Button>
                  </form>
                ) : (
                  row.claims?.length ? `${row.claims.length}` : '—'
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}