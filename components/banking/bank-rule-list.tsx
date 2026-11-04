'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { deleteBankRule, setBankRuleActive } from '@/app/(app)/banking/actions'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export type BankRuleRow = {
  id: string
  name: string
  contains: string
  active: boolean
  bank: string
  category: string
  payee: string
}

/**
 * The rules list. Turning one off stops it suggesting on the next import.
 * Deleting it removes the suggestion entirely. Neither posts anything.
 */
export function BankRuleList({ rules, canManage }: { rules: BankRuleRow[]; canManage: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Contains</TableHead>
          <TableHead>Bank</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Payee</TableHead>
          <TableHead>Active</TableHead>
          {canManage ? <TableHead className="w-28" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules.map((rule) => (
          <TableRow key={rule.id}>
            <TableCell className="font-medium">{rule.name}</TableCell>
            <TableCell>{rule.contains}</TableCell>
            <TableCell className="text-muted-foreground">{rule.bank}</TableCell>
            <TableCell>{rule.category}</TableCell>
            <TableCell className="text-muted-foreground">{rule.payee}</TableCell>
            <TableCell>{rule.active ? 'Yes' : 'No'}</TableCell>
            {canManage ? (
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const result = await setBankRuleActive({ id: rule.id, active: !rule.active })
                        if (!result.ok) {
                          toast.error(result.error.message)
                          return
                        }
                        router.refresh()
                      })
                    }
                  >
                    {rule.active ? 'Turn off' : 'Turn on'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        if (!window.confirm(`Delete the rule “${rule.name}”?`)) return
                        const result = await deleteBankRule({ id: rule.id })
                        if (!result.ok) {
                          toast.error(result.error.message)
                          return
                        }
                        router.refresh()
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
