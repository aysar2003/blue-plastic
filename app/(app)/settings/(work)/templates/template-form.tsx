'use client'

import { useActionState, useState } from 'react'
import { Eye, Pencil } from 'lucide-react'

import { updateDocumentTemplateForm } from '@/app/(app)/settings/(work)/organization/actions'
import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { TemplateLayoutPreview } from '@/components/templates/template-layout-preview'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PAPER_STYLE_OPTIONS, parseDocumentTemplate, type DocumentTemplate } from '@/lib/document-template'

const SLOTS = [1, 2, 3, 4, 5, 6]

export function TemplateForm({ template, canEdit }: { template: DocumentTemplate; canEdit: boolean }) {
  const [state, formAction] = useActionState(updateDocumentTemplateForm, idleState)
  const [draft, setDraft] = useState(template)
  const [uploadNote, setUploadNote] = useState<string | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const e = state.fieldErrors
  const editing = canEdit

  const banks = Array.from({ length: 6 }, (_, index) => draft.banks[index] ?? { name: '', account: '' })

  return (
    <form action={formAction} className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Document template</CardTitle>
              <CardDescription>
                The invoice and the invoice-by-invoice statement are drawn from this. Company name, phone, email, and
                address stay on Organisation. Sales person stays on the customer.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setViewOpen(true)}>
                <Eye className="size-3.5" />
                View
              </Button>
              <Button type="button" size="sm" variant="default" disabled={!canEdit}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormStatus state={state} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field name="accent" label="Colour" error={e?.accent}>
                  <Input
                    {...fieldProps('accent', e?.accent)}
                    type="color"
                    value={draft.accent}
                    disabled={!editing}
                    className="h-9 w-16 p-1"
                    onChange={(event) => setDraft({ ...draft, accent: event.target.value })}
                  />
                </Field>
                <p className="pb-2 font-mono text-xs text-muted-foreground">{draft.accent}</p>
                <Field name="vendorAccent" label="Vendor colour" error={e?.vendorAccent}>
                  <Input
                    {...fieldProps('vendorAccent', e?.vendorAccent)}
                    type="color"
                    value={draft.vendorAccent || '#0e7490'}
                    disabled={!editing}
                    className="h-9 w-16 p-1"
                    onChange={(event) => setDraft({ ...draft, vendorAccent: event.target.value })}
                  />
                </Field>
                <p className="pb-2 font-mono text-xs text-muted-foreground">
                  {draft.vendorAccent || '#0e7490'}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Account block</p>
                <p className="text-xs text-muted-foreground">
                  Printed at the bottom of every invoice and bill. Up to six accounts, plus a note for the branch or the name on the account.
                </p>
                <Field name="footerTitle" label="Heading" error={e?.footerTitle}>
                  <Input
                    {...fieldProps('footerTitle', e?.footerTitle)}
                    value={draft.footerTitle}
                    disabled={!editing}
                    placeholder="Account"
                    onChange={(event) => setDraft({ ...draft, footerTitle: event.target.value })}
                  />
                </Field>
                <Field name="footerLayout" label="Where it sits" error={e?.footerLayout}>
                  <select
                    {...fieldProps('footerLayout', e?.footerLayout)}
                    value={draft.footerLayout}
                    disabled={!editing}
                    className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        footerLayout: event.target.value as DocumentTemplate['footerLayout'],
                      })
                    }
                  >
                    <option value="side">Left of the totals</option>
                    <option value="bottom">Full row under the totals</option>
                    <option value="band">Coloured strip at the bottom</option>
                  </select>
                </Field>
                {SLOTS.map((slot, index) => (
                  <div key={slot} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
                    <Input
                      name={`bank${slot}Name`}
                      aria-label={`Bank ${slot} name`}
                      placeholder="Account name"
                      value={banks[index]?.name ?? ''}
                      disabled={!editing}
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
                      disabled={!editing}
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

              <Field name="footerNote" label="Note under the accounts" error={e?.footerNote}>
                <textarea
                  {...fieldProps('footerNote', e?.footerNote)}
                  value={draft.footerNote}
                  disabled={!editing}
                  rows={3}
                  placeholder="Name on the account, branch, or anything else the customer should see."
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  onChange={(event) => setDraft({ ...draft, footerNote: event.target.value })}
                />
              </Field>

              <Field name="terms" label="Terms and conditions" error={e?.terms}>
                <textarea
                  {...fieldProps('terms', e?.terms)}
                  value={draft.terms}
                  disabled={!editing}
                  rows={4}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  onChange={(event) => setDraft({ ...draft, terms: event.target.value })}
                />
              </Field>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Paper</legend>
                <p className="text-xs text-muted-foreground">
                  Invoices and purchase orders print on the sheet you pick. Save to use it.
                </p>
                <input type="hidden" name="paperStyle" value={draft.paperStyle} />
                <div className="grid gap-2 sm:grid-cols-2">
                  {PAPER_STYLE_OPTIONS.map((option) => {
                    const selected = draft.paperStyle === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={!editing}
                        onClick={() => setDraft({ ...draft, paperStyle: option.id })}
                        className={`rounded-lg border px-3 py-2 text-left ${
                          selected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                        }`}
                      >
                        <span className="block text-sm font-medium">{option.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{option.blurb}</span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <label className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3">
                <input
                  type="checkbox"
                  name="showClassicPaper"
                  value="true"
                  checked={draft.showClassicPaper}
                  disabled={!editing}
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
            </div>

            <aside className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
              <TemplateLayoutPreview
                kind={draft.paperStyle === 'trade' ? 'trade' : 'document'}
                accent={draft.accent}
                size="stage"
              />
              {draft.banks.some((bank) => bank.name || bank.account) ? (
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  {draft.banks
                    .filter((bank) => bank.name || bank.account)
                    .slice(0, 3)
                    .map((bank, index) => (
                      <li key={`${bank.name}-${index}`}>
                        {bank.name}
                        {bank.account ? ` · ${bank.account}` : ''}
                      </li>
                    ))}
                </ul>
              ) : null}
              {draft.terms ? (
                <p className="line-clamp-3 text-[11px] text-muted-foreground">{draft.terms}</p>
              ) : null}
            </aside>
          </div>
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

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>View · Invoice & statement paper</DialogTitle>
            <DialogDescription>Sida template-kan u muuqdo with your colour, banks, and terms.</DialogDescription>
          </DialogHeader>
          <TemplateLayoutPreview
            kind={draft.paperStyle === 'trade' ? 'trade' : 'document'}
            accent={draft.accent}
            size="stage"
            className="mx-auto"
          />
          {draft.banks.some((bank) => bank.name || bank.account) ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {draft.banks
                .filter((bank) => bank.name || bank.account)
                .map((bank, index) => (
                  <li key={`${bank.name}-${index}`}>
                    {bank.name}
                    {bank.account ? ` · ${bank.account}` : ''}
                  </li>
                ))}
            </ul>
          ) : null}
          {draft.terms ? <p className="text-sm text-muted-foreground">{draft.terms}</p> : null}
        </DialogContent>
      </Dialog>
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
