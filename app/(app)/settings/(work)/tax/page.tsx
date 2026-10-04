import type { Metadata } from 'next'
import { PercentIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as accountService from '@/server/services/account.service'
import * as taxService from '@/server/services/tax.service'
import { AgencyButton, CodeButton, RateButton } from './tax-forms'

export const metadata: Metadata = { title: 'Tax' }

const FREQUENCY = { MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', ANNUALLY: 'Annually' } as const
const APPLIES = { BOTH: 'Sales and purchases', SALES: 'Sales', PURCHASES: 'Purchases' } as const

export default async function TaxSettingsPage() {
  const ctx = await requireOrgContext('tax:read')

  const [agencies, rates, codes, accounts] = await Promise.all([
    taxService.listAgencies(ctx),
    taxService.listRates(ctx),
    taxService.listCodes(ctx),
    accountService.postableAccounts(ctx),
  ])

  const canManage = ctx.permissions.has('tax:manage')
  const liabilityAccounts = accounts
    .filter((account) => account.type === 'LIABILITY')
    .map((account) => ({ id: account.id, label: `${account.code} ${account.name}` }))

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Tax is defined here and applied to documents from phase 4. A <strong>rate</strong> is one
        percentage owed to one agency; a <strong>code</strong> is what someone picks on a line, and may
        combine several rates.
      </p>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Agencies</CardTitle>
            <CardDescription>Who the tax is owed to.</CardDescription>
          </div>
          {canManage ? <AgencyButton /> : null}
        </CardHeader>
        <CardContent className="p-0">
          {agencies.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No agencies yet. Add the authority you file with before creating rates.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Registration</TableHead>
                  <TableHead>Filing</TableHead>
                  <TableHead className="numeric w-20">Rates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencies.map((agency) => (
                  <TableRow key={agency.id}>
                    <TableCell className="font-medium">{agency.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {agency.registrationNumber ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {FREQUENCY[agency.filingFrequency]}
                    </TableCell>
                    <TableCell className="numeric tabular">{agency._count.rates}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Rates</CardTitle>
            <CardDescription>
              Held to nine decimal places, so a third-of-a-percent levy survives the arithmetic.
            </CardDescription>
          </div>
          {canManage ? <RateButton agencies={agencies.map((a) => ({ id: a.id, label: a.name }))} accounts={liabilityAccounts} /> : null}
        </CardHeader>
        <CardContent className="p-0">
          {rates.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No rates yet. {agencies.length === 0 ? 'Add an agency first.' : ''}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="numeric w-24">Rate</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead>Posts to</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">{rate.name}</TableCell>
                    <TableCell className="numeric tabular">
                      {(Number(rate.rate) * 100).toFixed(3).replace(/\.?0+$/, '')}%
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rate.agency.name}</TableCell>
                    <TableCell className="text-muted-foreground">{APPLIES[rate.appliesTo]}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {rate.salesAccount ? `${rate.salesAccount.code} ${rate.salesAccount.name}` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Tax codes</CardTitle>
            <CardDescription>What appears in the dropdown on a document line.</CardDescription>
          </div>
          {canManage ? (
            <CodeButton rates={rates.map((r) => ({ id: r.id, label: r.name, rate: r.rate }))} />
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {codes.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState
                icon={PercentIcon}
                title="No tax codes yet"
                description={
                  rates.length === 0
                    ? 'Add an agency and a rate first, then combine rates into a code.'
                    : 'Combine one or more rates into a code that can be picked on an invoice line.'
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Rates</TableHead>
                  <TableHead className="w-32">Pricing</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell>
                      <span className="block font-medium">{code.name}</span>
                      {code.description ? (
                        <span className="block text-xs text-muted-foreground">{code.description}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {code.components.map((component) => (
                        <span key={component.id} className="mr-2 whitespace-nowrap">
                          {component.taxRate.name} {(Number(component.taxRate.rate) * 100).toFixed(2)}%
                          {component.isCompound ? (
                            <Badge variant="outline" className="ml-1">
                              compound
                            </Badge>
                          ) : null}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={code.isInclusive ? 'warning' : 'secondary'}>
                        {code.isInclusive ? 'Tax included' : 'Tax added'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={code.isActive ? 'success' : 'outline'}>
                        {code.isActive ? 'active' : 'archived'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
