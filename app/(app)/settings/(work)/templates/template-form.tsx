'use client'

import { useActionState, useState } from 'react'

import { updateDocumentTemplateForm } from '@/app/(app)/settings/(work)/organization/actions'
import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { parseDocumentTemplate, type DocumentTemplate } from '@/lib/document-template'

const SLOTS = [1, 2, 3, 4, 5, 6]

export function TemplateForm({ template, canEdit }: { template: DocumentTemplate; canEdit: boolean }) {
  const [state, formAction] = useActionState(updateDocumentTemplateForm, idleState)
  const [draft, setDraft] = useState(template)
  const [uploadNote, setUploadNote] = useState<string | null>(null)
  const e = state.fieldErrors

  const banks = Array.from({ length: 6 }, (_, index) => draft.banks[index] ?? { name: '', account: '' })

  return (
    <form action={formAction} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Document template</CardTitle>
          <CardDescription>
            The invoice and the invoice-by-invoice statement are drawn from this. Company name, phone, email, and
            address stay on Organisation. Sales person stays on the customer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormStatus state={state} />
          <div className="flex flex-wrap items-end gap-3">
            <Field name="accent" label="Colour" error={e?.accent}>
              <Input
                {...fieldProps('accent', e?.accent)}
                type="color"
                value={draft.accent}
                disabled={!canEdit}
                className="h-9 w-16 p-1"
                onChange={(event) => setDraft({ ...draft, accent: event.target.value })}
              />
            </Field>
            <p className="pb-2 font-mono text-xs text-muted-foreground">{draft.accent}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Bank details</p>
            <p className="text-xs text-muted-foreground">
              Printed on the left of the bill. Hormud, Somtel, Premier Wallet, or any account you collect with.
            </p>
            {SLOTS.map((slot, index) => (
              <div key={slot} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <Input
                  name={`bank${slot}Name`}
                  aria-label={`Bank ${slot} name`}
                  placeholder="Account name"
                  value={banks[index]?.name ?? ''}
                  disabled={!canEdit}
                  onChange={(event) => {
                    const next = banks.map((bank, bankIndex) =>
                      bankIndex === index ? { ...bank, name: event.target.value } : bank,
                    )
                    setDraft({ ...draft, banks: next })
                  }}
                />
                <Input
                  name={`bank${slot}Account`}
                  aria-label={`Bank ${slot} number`}
                  placeholder="Number"
                  value={banks[index]?.account ?? ''}
                  disabled={!canEdit}
                  className="tabular"
                  onChange={(event) => {
                    const next = banks.map((bank, bankIndex) =>
                      bankIndex === index ? { ...bank, account: event.target.value } : bank,
                    )
                    setDraft({ ...draft, banks: next })
                  }}
                />
              </div>
            ))}
          </div>

          <Field name="terms" label="Terms and conditions" error={e?.terms}>
            <textarea
              {...fieldProps('terms', e?.terms)}
              value={draft.terms}
              disabled={!canEdit}
              rows={4}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              onChange={(event) => setDraft({ ...draft, terms: event.target.value })}
            />
          </Field>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3">
            <input
              type="checkbox"
              name="showClassicPaper"
              value="true"
              checked={draft.showClassicPaper}
              disabled={!canEdit}
              className="mt-1 size-4 rounded border-input"
              onChange={(event) => setDraft({ ...draft, showClassicPaper: event.target.checked })}
            />
            <span>
              <span className="block text-sm font-medium">Show Classic paper</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                The older invoice-by-invoice sheet. Hidden until this is on. Turn it on when you want that button on
                the statement.
              </span>
            </span>
          </label>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!canEdit} onClick={() => download(draft)}>
              Download template
            </Button>
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                disabled={!canEdit}
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (!file) return
                  try {
                    const parsed = parseDocumentTemplate(JSON.parse(await file.text()))
                    setDraft(parsed)
                    setUploadNote(`Loaded ${file.name}. Save to use it.`)
                  } catch {
                    setUploadNote('That file is not a template. Use a JSON file downloaded from here.')
                  }
                }}
              />
              <span className="inline-flex h-7 items-center rounded-md border border-input bg-card px-2.5 text-xs font-medium hover:bg-accent">
                Upload template
              </span>
            </label>
          </div>
          {canEdit ? <SubmitButton>Save template</SubmitButton> : null}
        </CardFooter>
      </Card>
      {uploadNote ? <p className="text-sm text-muted-foreground">{uploadNote}</p> : null}
    </form>
  )
}

function download(template: DocumentTemplate) {
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'invoice-template.json'
  link.click()
  URL.revokeObjectURL(url)
}
