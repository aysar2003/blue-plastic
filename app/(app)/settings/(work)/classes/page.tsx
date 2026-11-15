import type { Metadata } from 'next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as trackingCategories from '@/server/services/tracking-category.service'
import { setRestrictSpendingAction } from './actions'
import { ClassButton, ClassRowActions } from './class-form'
import { SubmitButton } from '@/components/forms/submit-button'

export const metadata: Metadata = { title: 'Classes' }

export default async function ClassesPage() {
  const ctx = await requireOrgContext('org:read')
  const rows = await trackingCategories.list(ctx, { includeInactive: true })
  const canManage = ctx.permissions.has('tax:manage')

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Classes</CardTitle>
          <CardDescription>
            One optional label on a sale, a purchase, or a journal line. Profit and loss by class
            reads it. A document with no class stays Unclassified.
          </CardDescription>
        </div>
        {canManage ? <ClassButton /> : null}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Restricted fund</TableHead>
              {canManage ? <TableHead className="w-40" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 3} className="text-muted-foreground">
                  No classes yet. Add one when a shop or department needs its own profit.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    {row.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Archived</Badge>}
                  </TableCell>
                  <TableCell>
                    {row.restrictSpending ? (
                      <Badge variant="destructive">Restrict spending</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {canManage && row.isActive ? (
                      <form action={setRestrictSpendingAction} className="mt-1">
                        <input type="hidden" name="id" value={row.id} />
                        <input
                          type="hidden"
                          name="restrictSpending"
                          value={row.restrictSpending ? 'false' : 'true'}
                        />
                        <SubmitButton variant="ghost" size="sm" pendingLabel="Saving…">
                          {row.restrictSpending ? 'Allow all spend' : 'Restrict spend'}
                        </SubmitButton>
                      </form>
                    ) : null}
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <ClassRowActions id={row.id} name={row.name} isActive={row.isActive} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
