'use client'

import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'

const SHEETS = [
  {
    kind: 'customer',
    label: 'Customers',
    blurb: 'Display name, contacts, terms, opening balance.',
  },
  {
    kind: 'vendor',
    label: 'Vendors',
    blurb: 'Supplier list ready for import.',
  },
  {
    kind: 'item',
    label: 'Products',
    blurb: 'Products and services with prices and stock.',
  },
] as const

export function ImportTemplatesPanel() {
  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">Import spreadsheets</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Download a blank sheet, fill it, then import from Customers, Vendors, or Products. Column
          names match what the importer reads.
        </p>
      </div>
      <ul className="space-y-2">
        {SHEETS.map((sheet) => (
          <li
            key={sheet.kind}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">{sheet.label}</p>
              <p className="text-xs text-muted-foreground">{sheet.blurb}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`/api/import-templates/${sheet.kind}`} download>
                  <Download className="size-3.5" />
                  Excel
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/import-templates/${sheet.kind}?format=csv`} download>
                  <Download className="size-3.5" />
                  CSV
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href={`/api/import-templates/${sheet.kind}?sample=1`} download>
                  Sample
                </a>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
