'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowRight,
  CheckIcon,
  Download,
  FileText,
  FolderPlus,
  LayoutTemplate,
  Printer,
  Receipt,
  Rows3,
} from 'lucide-react'

import { ReportStylePicker } from '@/app/(app)/settings/(work)/appearance/report-style-picker'
import { FormLayoutPicker } from '@/app/(app)/settings/(work)/templates/form-layout-picker'
import { ImportTemplatesPanel } from '@/app/(app)/settings/(work)/templates/import-templates-panel'
import { MyTemplatesPanel } from '@/app/(app)/settings/(work)/templates/my-templates-panel'
import { PosReceiptPicker } from '@/app/(app)/settings/(work)/templates/pos-receipt-picker'
import { TemplateForm } from '@/app/(app)/settings/(work)/templates/template-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DocumentTemplate } from '@/lib/document-template'
import {
  DEFAULT_REPORT_SHEET_TEMPLATE,
  parseReportSheetTemplate,
  REPORT_SHEET_TEMPLATE_KEY,
  REPORT_SHEET_TEMPLATES,
} from '@/lib/report-sheet-templates'
import {
  DEFAULT_INVOICE_FORM_TEMPLATE,
  DEFAULT_SALES_FORM_TEMPLATE,
  DEFAULT_SALES_RECEIPT_FORM_TEMPLATE,
  INVOICE_FORM_TEMPLATES,
  INVOICE_FORM_TEMPLATE_STORAGE_KEY,
  isInvoiceFormTemplateId,
  isSalesFormTemplateId,
  isSalesReceiptFormTemplateId,
  SALES_FORM_TEMPLATES,
  SALES_FORM_TEMPLATE_STORAGE_KEY,
  SALES_RECEIPT_FORM_TEMPLATES,
  SALES_RECEIPT_FORM_TEMPLATE_STORAGE_KEY,
} from '@/lib/sales-form-templates'
import {
  DEFAULT_SYSTEM_TEMPLATE,
  SYSTEM_TEMPLATES,
  type SystemTemplateKind,
} from '@/lib/system-templates'
import { cn } from '@/lib/utils'

const ICONS: Partial<Record<SystemTemplateKind, typeof FileText>> = {
  document: FileText,
  'invoice-form': LayoutTemplate,
  'sales-receipt-form': Receipt,
  'sales-form': LayoutTemplate,
  'report-paper': FileText,
  'report-sheet': Rows3,
  'pos-receipt': Printer,
  'import-sheets': Download,
  'my-templates': FolderPlus,
}

export function TemplatesHub({
  template,
  canEdit,
}: {
  template: DocumentTemplate
  canEdit: boolean
}) {
  const [active, setActive] = useState<SystemTemplateKind>(DEFAULT_SYSTEM_TEMPLATE)
  const current = SYSTEM_TEMPLATES.find((entry) => entry.id === active) ?? SYSTEM_TEMPLATES[0]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Templates</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dhammaan foomamka jira + kuwa aad mustaqbalka ku soo dari doonto. All built-in form and
          paper layouts, plus My templates for papers you add yourself.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <nav aria-label="Template catalog" className="space-y-1.5">
          {SYSTEM_TEMPLATES.map((entry) => {
            const Icon = ICONS[entry.id] ?? FileText
            const selected = entry.id === active
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setActive(entry.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                  selected
                    ? 'border-primary bg-accent/50 ring-1 ring-primary/20'
                    : 'border-transparent bg-card hover:border-border hover:bg-secondary/60',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 grid size-8 shrink-0 place-items-center rounded-md',
                    selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{entry.label}</span>
                    {selected ? <CheckIcon className="size-3.5 shrink-0 text-primary" aria-hidden /> : null}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {entry.blurb}
                  </span>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="min-w-0 space-y-4">
          {!current.managedHere && current.href ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{current.label}</CardTitle>
                <CardDescription>{current.blurb}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href={current.href}>
                    {current.hrefLabel ?? 'Open'}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div>
              <h3 className="text-base font-semibold">{current.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{current.blurb}</p>
            </div>
          )}

          {active === 'document' ? <TemplateForm template={template} canEdit={canEdit} /> : null}

          {active === 'invoice-form' ? (
            <FormLayoutPicker
              title="Invoice & quotation layout"
              description="Used when you open an invoice, estimate, or quotation form."
              storageKey={INVOICE_FORM_TEMPLATE_STORAGE_KEY}
              options={INVOICE_FORM_TEMPLATES}
              defaultId={DEFAULT_INVOICE_FORM_TEMPLATE}
              accent={template.accent}
              parse={(raw) => (isInvoiceFormTemplateId(raw ?? '') ? raw! : DEFAULT_INVOICE_FORM_TEMPLATE)}
            />
          ) : null}

          {active === 'sales-receipt-form' ? (
            <FormLayoutPicker
              title="Sales receipt layout"
              description="Used on sales receipts from Sales and related screens."
              storageKey={SALES_RECEIPT_FORM_TEMPLATE_STORAGE_KEY}
              options={SALES_RECEIPT_FORM_TEMPLATES}
              defaultId={DEFAULT_SALES_RECEIPT_FORM_TEMPLATE}
              accent={template.accent}
              parse={(raw) =>
                isSalesReceiptFormTemplateId(raw ?? '') ? raw! : DEFAULT_SALES_RECEIPT_FORM_TEMPLATE
              }
            />
          ) : null}

          {active === 'sales-form' ? (
            <FormLayoutPicker
              title="Other sales document layout"
              description="Default for credit memos, refunds, and related sales papers that still offer layout picks."
              storageKey={SALES_FORM_TEMPLATE_STORAGE_KEY}
              options={SALES_FORM_TEMPLATES}
              defaultId={DEFAULT_SALES_FORM_TEMPLATE}
              accent={template.accent}
              parse={(raw) => (isSalesFormTemplateId(raw ?? '') ? raw! : DEFAULT_SALES_FORM_TEMPLATE)}
            />
          ) : null}

          {active === 'report-paper' ? (
            <section className="space-y-3 rounded-md border border-border bg-card p-4">
              <div>
                <h3 className="text-sm font-semibold">Report paper style</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Row bands and section marks on Profit &amp; Loss, Balance Sheet, and other reports.
                </p>
              </div>
              <ReportStylePicker />
            </section>
          ) : null}

          {active === 'report-sheet' ? (
            <FormLayoutPicker
              title="Report & chart density"
              description="How dense the rows look on reports and the chart of accounts."
              storageKey={REPORT_SHEET_TEMPLATE_KEY}
              options={REPORT_SHEET_TEMPLATES}
              defaultId={DEFAULT_REPORT_SHEET_TEMPLATE}
              accent={template.accent}
              parse={(raw) => parseReportSheetTemplate(raw)}
              persistHint="Saved in this browser. Reports, the chart of accounts, and bank account lists use the row style you pick here."
            />
          ) : null}

          {active === 'pos-receipt' ? <PosReceiptPicker /> : null}

          {active === 'import-sheets' ? <ImportTemplatesPanel /> : null}

          {active === 'my-templates' ? (
            <MyTemplatesPanel currentDocument={template} canEdit={canEdit} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
