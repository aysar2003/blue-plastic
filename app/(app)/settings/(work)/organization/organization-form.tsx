'use client'

import { useActionState } from 'react'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { TIME_ZONES } from '@/lib/constants'
import { updateOrganizationForm } from './actions'

type Organization = {
  name: string
  legalName: string | null
  taxRegistrationNumber: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  country: string | null
  phone: string | null
  email: string | null
  website: string | null
  timeZone: string
}

export function OrganizationForm({ organization, canEdit }: { organization: Organization; canEdit: boolean }) {
  const [state, formAction] = useActionState(updateOrganizationForm, idleState)
  const e = state.fieldErrors

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisation details</CardTitle>
          <CardDescription>
            These appear on invoices, statements and every report you export.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <FormStatus state={state} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="name" label="Display name" required error={e?.name}>
              <Input {...fieldProps('name', e?.name)} defaultValue={organization.name} disabled={!canEdit} required />
            </Field>

            <Field name="legalName" label="Legal name" hint="If it differs from the trading name." error={e?.legalName}>
              <Input
                {...fieldProps('legalName', e?.legalName, true)}
                defaultValue={organization.legalName ?? ''}
                disabled={!canEdit}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="taxRegistrationNumber" label="Tax registration number" error={e?.taxRegistrationNumber}>
              <Input
                {...fieldProps('taxRegistrationNumber', e?.taxRegistrationNumber)}
                defaultValue={organization.taxRegistrationNumber ?? ''}
                disabled={!canEdit}
              />
            </Field>

            <Field
              name="timeZone"
              label="Time zone"
              hint="Determines what counts as today when dating a transaction."
              required
              error={e?.timeZone}
            >
              <NativeSelect
                {...fieldProps('timeZone', e?.timeZone, true)}
                defaultValue={organization.timeZone}
                disabled={!canEdit}
              >
                {TIME_ZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <Field name="addressLine1" label="Address" error={e?.addressLine1}>
            <Input
              {...fieldProps('addressLine1', e?.addressLine1)}
              defaultValue={organization.addressLine1 ?? ''}
              disabled={!canEdit}
              placeholder="Street address"
            />
          </Field>

          <Field name="addressLine2" label="Address line 2" error={e?.addressLine2}>
            <Input
              {...fieldProps('addressLine2', e?.addressLine2)}
              defaultValue={organization.addressLine2 ?? ''}
              disabled={!canEdit}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="city" label="City" error={e?.city}>
              <Input {...fieldProps('city', e?.city)} defaultValue={organization.city ?? ''} disabled={!canEdit} />
            </Field>
            <Field name="region" label="State / region" error={e?.region}>
              <Input {...fieldProps('region', e?.region)} defaultValue={organization.region ?? ''} disabled={!canEdit} />
            </Field>
            <Field name="postalCode" label="Postal code" error={e?.postalCode}>
              <Input
                {...fieldProps('postalCode', e?.postalCode)}
                defaultValue={organization.postalCode ?? ''}
                disabled={!canEdit}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="country" label="Country code" hint="Two letters, e.g. US." error={e?.country}>
              <Input
                {...fieldProps('country', e?.country, true)}
                defaultValue={organization.country ?? ''}
                disabled={!canEdit}
                maxLength={2}
                className="uppercase"
              />
            </Field>
            <Field name="phone" label="Phone" error={e?.phone}>
              <Input {...fieldProps('phone', e?.phone)} defaultValue={organization.phone ?? ''} disabled={!canEdit} />
            </Field>
            <Field name="email" label="Email" error={e?.email}>
              <Input
                {...fieldProps('email', e?.email)}
                type="email"
                defaultValue={organization.email ?? ''}
                disabled={!canEdit}
              />
            </Field>
          </div>

          <Field name="website" label="Website" error={e?.website}>
            <Input {...fieldProps('website', e?.website)} defaultValue={organization.website ?? ''} disabled={!canEdit} />
          </Field>
        </CardContent>

        {canEdit ? (
          <CardFooter className="justify-end">
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          </CardFooter>
        ) : null}
      </Card>
    </form>
  )
}
