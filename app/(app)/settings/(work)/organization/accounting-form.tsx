'use client'

import { useActionState } from 'react'
import { LockIcon } from 'lucide-react'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CURRENCIES, MONTH_DAYS, MONTHS } from '@/lib/constants'
import { NativeSelect } from '@/components/ui/native-select'
import { updateAccountingSettingsForm } from './actions'

export function AccountingForm({
  baseCurrency,
  fiscalYearStartMonth,
  fiscalYearStartDay,
  canEdit,
}: {
  baseCurrency: string
  fiscalYearStartMonth: number
  fiscalYearStartDay: number
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

          <div className="space-y-2">
            <p className="text-sm font-medium">Fiscal year starts</p>
            <p className="text-xs text-muted-foreground">
              The anniversary the books open on each year (for example 20 April → 19 April next year).
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="fiscalYearStartMonth" label="Month" required error={e?.fiscalYearStartMonth}>
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

              <Field name="fiscalYearStartDay" label="Day" required error={e?.fiscalYearStartDay}>
                <NativeSelect
                  {...fieldProps('fiscalYearStartDay', e?.fiscalYearStartDay)}
                  defaultValue={String(fiscalYearStartDay)}
                  disabled={!canEdit}
                >
                  {MONTH_DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
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
