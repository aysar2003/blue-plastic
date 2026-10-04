'use client'

import { useActionState } from 'react'
import { LockIcon } from 'lucide-react'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CURRENCIES, MONTHS } from '@/lib/constants'
import { NativeSelect } from '@/components/ui/native-select'
import { updateAccountingSettingsForm } from './actions'

export function AccountingForm({
  baseCurrency,
  fiscalYearStartMonth,
  canEdit,
}: {
  baseCurrency: string
  fiscalYearStartMonth: number
  canEdit: boolean
}) {
  const [state, formAction] = useActionState(updateAccountingSettingsForm, idleState)
  const e = state.fieldErrors

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accounting settings</CardTitle>
          <CardDescription>
            These define how every journal is recorded and reported.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <FormStatus state={state} />

          <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <LockIcon className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Both settings lock permanently once the first transaction is posted. Changing them afterwards
              would restate history rather than correct it.
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="baseCurrency" label="Base currency" required error={e?.baseCurrency}>
              <NativeSelect
                {...fieldProps('baseCurrency', e?.baseCurrency)}
                defaultValue={baseCurrency}
                disabled={!canEdit}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field name="fiscalYearStartMonth" label="Fiscal year starts" required error={e?.fiscalYearStartMonth}>
              <NativeSelect
                {...fieldProps('fiscalYearStartMonth', e?.fiscalYearStartMonth)}
                defaultValue={String(fiscalYearStartMonth)}
                disabled={!canEdit}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </CardContent>

        {canEdit ? (
          <CardFooter className="justify-end">
            <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
          </CardFooter>
        ) : null}
      </Card>
    </form>
  )
}
