'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { orgLogoUrl, resolveBrandMark } from '@/lib/org-brand'
import { clearOrganizationLogoForm, updateOrganizationBrandingForm, uploadOrganizationLogoForm } from './actions'

type Branding = {
  name: string
  brandMark: string | null
  hasLogo: boolean
  updatedAt: Date | string
}

export function BrandingForm({ branding, canEdit }: { branding: Branding; canEdit: boolean }) {
  const router = useRouter()
  const [markState, markAction] = useActionState(updateOrganizationBrandingForm, idleState)
  const [logoState, logoAction] = useActionState(uploadOrganizationLogoForm, idleState)
  const [clearState, clearAction] = useActionState(clearOrganizationLogoForm, idleState)
  const [preview, setPreview] = useState<string | null>(null)

  const mark = resolveBrandMark(branding.brandMark, branding.name)
  const logoSrc = preview ?? orgLogoUrl(branding.hasLogo, branding.updatedAt)

  useEffect(() => {
    if (
      logoState.status === 'success' ||
      clearState.status === 'success' ||
      markState.status === 'success'
    ) {
      router.refresh()
    }
  }, [logoState.status, clearState.status, markState.status, router])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company brand</CardTitle>
          <CardDescription>
            Logo and mark in the top-left of every screen. Change the company name above, or set a short
            mark and upload a logo here.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
            {logoSrc ? (
              <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-background shadow-sm ring-1 ring-border/60">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob / auth API */}
                <img src={logoSrc} alt="" className="size-full object-contain p-0.5" />
              </span>
            ) : (
              <span className="shell-brand-mark grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold tracking-wide text-primary-foreground shadow-sm">
                {mark}
              </span>
            )}
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold tracking-tight">{branding.name}</span>
              <span className="block truncate text-[0.65rem] text-muted-foreground">Preview · top bar</span>
            </span>
          </div>

          <form action={markAction} className="space-y-4">
            <FormStatus state={markState} />
            <Field
              name="brandMark"
              label="Mark / initials"
              hint="1–4 letters shown when there is no logo. Leave blank to use initials from the company name."
              error={markState.fieldErrors?.brandMark}
            >
              <Input
                {...fieldProps('brandMark', markState.fieldErrors?.brandMark)}
                defaultValue={branding.brandMark ?? ''}
                maxLength={4}
                placeholder={mark}
                disabled={!canEdit}
                className="max-w-[8rem] uppercase tracking-wider"
              />
            </Field>
            {canEdit ? (
              <SubmitButton pendingLabel="Saving…">Save mark</SubmitButton>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company logo</CardTitle>
          <CardDescription>JPEG, PNG, or WebP · up to 2 MB. Replaces the mark square in the header.</CardDescription>
        </CardHeader>
        <form action={logoAction}>
          <CardContent className="space-y-4">
            <FormStatus state={logoState} />
            <Field name="logo" label="Logo file" error={logoState.fieldErrors?.logo}>
              <Input
                name="logo"
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                disabled={!canEdit}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (preview) URL.revokeObjectURL(preview)
                  setPreview(file ? URL.createObjectURL(file) : null)
                }}
              />
            </Field>
          </CardContent>
          {canEdit ? (
            <CardFooter className="flex flex-wrap gap-2">
              <SubmitButton pendingLabel="Uploading…">Upload logo</SubmitButton>
            </CardFooter>
          ) : null}
        </form>
        {canEdit && branding.hasLogo ? (
          <CardFooter className="border-t pt-4">
            <form action={clearAction}>
              <FormStatus state={clearState} />
              <Button type="submit" variant="outline" size="sm">
                Remove logo
              </Button>
            </form>
          </CardFooter>
        ) : null}
      </Card>
    </div>
  )
}
