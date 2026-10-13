'use client'

import { useActionState } from 'react'

import { updateEnableTaxForm } from '@/app/(app)/settings/(work)/organization/actions'
import { idleState } from '@/components/forms/action-state'
import { SubmitButton } from '@/components/forms/submit-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Company tax master switch. Lives on Settings → Tax so it is not mixed with
 * ERP system Limits (Databases) or Apps & features module toggles.
 */
export function TaxEnabledForm({
  enableTax,
  companyName,
  canEdit,
}: {
  enableTax: boolean
  companyName: string
  canEdit: boolean
}) {
  const [state, action] = useActionState(updateEnableTaxForm, idleState)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Use tax in this company</CardTitle>
        <CardDescription>
          Company setting for <span className="font-medium text-foreground">{companyName}</span>{' '}
          only. It does not change ERP system Limits under Databases, and other companies keep
          their own choice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canEdit ? (
          <form action={action} className="space-y-3">
            {state.status !== 'idle' && state.message ? (
              <p
                className={
                  state.status === 'success' ? 'text-sm text-primary' : 'text-sm text-destructive'
                }
              >
                {state.message}
              </p>
            ) : null}
            <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3">
              <input
                type="checkbox"
                name="enableTax"
                value="true"
                defaultChecked={enableTax}
                className="mt-1 size-4 rounded border-input"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">Sales and purchase tax</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  When off, tax fields disappear from items, invoices, and bills for everyone in
                  this company, and new documents will not apply tax.
                </span>
              </span>
            </label>
            <SubmitButton>Save tax setting</SubmitButton>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tax is currently <strong>{enableTax ? 'on' : 'off'}</strong> for this company. Ask
            someone with organisation settings access to change it.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
