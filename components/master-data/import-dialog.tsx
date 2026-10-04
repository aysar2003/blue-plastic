'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangleIcon, CheckCircle2Icon, DownloadIcon, Loader2Icon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  previewCustomerImport,
  runCustomerImport,
  previewVendorImport,
  runVendorImport,
} from '@/app/(app)/customers/actions'
import { previewItemImport, runItemImport } from '@/app/(app)/items/actions'

type Preview = {
  total: number
  ready: number
  skipped: number
  issues: { row: number; field?: string; message: string }[]
  sample: { row: number; displayName: string; email: string; balance: string }[]
  imported?: number
}

/**
 * Import always previews first. A file of customers is exactly the kind of thing
 * nobody checks afterwards, so the only honest flow is to say what will happen,
 * what will be skipped and why, before anything is written.
 */
export function ImportDialog({
  kind,
  columns,
}: {
  kind: 'customer' | 'vendor' | 'item'
  columns: { name: string; required: boolean; aliases: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [workbook, setWorkbook] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const noun = kind === 'customer' ? 'customers' : kind === 'vendor' ? 'vendors' : 'products'
  const one = kind === 'customer' ? 'customer' : kind === 'vendor' ? 'vendor' : 'product'
  const file = { csv, workbook }
  const required = columns.filter((column) => column.required)
  const optional = columns.filter((column) => !column.required)

  const reset = () => {
    setCsv('')
    setWorkbook('')
    setPreview(null)
    setError(null)
    setOpen(false)
  }

  const readFile = (chosen: File) => {
    setPreview(null)
    const excel = /\.xlsx$/i.test(chosen.name)
    const reader = new FileReader()
    reader.onload = () => {
      if (excel) {
        const result = String(reader.result ?? '')
        setWorkbook(result.slice(result.indexOf(',') + 1))
        setCsv('')
      } else {
        setCsv(String(reader.result ?? ''))
        setWorkbook('')
      }
    }
    if (excel) reader.readAsDataURL(chosen)
    else reader.readAsText(chosen)
  }

  const check = () =>
    startTransition(async () => {
      setError(null)
      const result =
        kind === 'item'
          ? await previewItemImport(file)
          : kind === 'vendor'
            ? await previewVendorImport(file)
            : await previewCustomerImport(file)
      if (result.ok) setPreview(result.data)
      else setError(result.error.message)
    })

  const commit = () =>
    startTransition(async () => {
      setError(null)
      const result =
        kind === 'item'
          ? await runItemImport(file)
          : kind === 'vendor'
            ? await runVendorImport(file)
            : await runCustomerImport(file)
      if (result.ok) {
        toast.success(`${result.data.imported} ${noun} imported.`)
        router.refresh()
        reset()
      } else {
        setError(result.error.message)
      }
    })

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UploadIcon /> Import
      </Button>
    )
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) reset() }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import {noun}</DialogTitle>
        </DialogHeader>
        <ol className="mt-3 space-y-4 text-sm">
          <li>
            <p className="font-medium">1. Download a sheet</p>
            <p className="mt-1 text-muted-foreground">
              Fill the blank sheet, one row per {one}, then come back and upload it here. Do not
              rename the headings. The sample shows three finished rows: the first uses every column,
              and the other two leave the optional ones blank.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <DownloadLink href={`/api/import-templates/${kind}`} label="Blank Excel" />
              <DownloadLink href={`/api/import-templates/${kind}?format=csv`} label="Blank CSV" />
              <DownloadLink href={`/api/import-templates/${kind}?sample=1`} label="Sample Excel" />
              <DownloadLink href={`/api/import-templates/${kind}?sample=1&format=csv`} label="Sample CSV" />
            </div>
          </li>
          <li>
            <p className="font-medium">2. Required and optional columns</p>
            <p className="mt-1 text-muted-foreground">
              Required must be filled. Optional can be left empty. A QuickBooks export can use its own
              names for the same fields.
            </p>
            <div className="mt-2 max-h-44 space-y-3 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs">
              <ColumnList title="Required" columns={required} />
              <ColumnList title="Optional" columns={optional} />
            </div>
          </li>
          <li>
            <p className="font-medium">3. Upload the filled sheet</p>
            <p className="mt-1 text-muted-foreground">
              Nothing is written until you have seen what will happen. Replace the sample rows with
              your own before you import that file.
            </p>
          </li>
        </ol>

        {error ? (
          <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="csv-file" className="mb-1.5 block text-sm font-medium">
              File
            </label>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) readFile(file)
              }}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          </div>

          {preview ? (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-success">
                  <CheckCircle2Icon className="size-4" />
                  <span className="tabular font-medium">{preview.ready}</span> ready
                </span>
                {preview.skipped > 0 ? (
                  <span className="flex items-center gap-1.5 text-warning-foreground dark:text-warning">
                    <AlertTriangleIcon className="size-4" />
                    <span className="tabular font-medium">{preview.skipped}</span> skipped
                  </span>
                ) : null}
                <span className="text-muted-foreground">
                  of <span className="tabular">{preview.total}</span> rows
                </span>
              </div>

              {preview.sample.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded border">
                  <table className="w-full text-xs">
                    <tbody>
                      {preview.sample.map((row) => (
                        <tr key={row.row} className="border-b last:border-0">
                          <td className="tabular px-2 py-1 text-muted-foreground">{row.row}</td>
                          <td className="px-2 py-1 font-medium">{row.displayName}</td>
                          <td className="px-2 py-1 text-muted-foreground">{row.email}</td>
                          <td className="tabular px-2 py-1 text-right">{row.balance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {preview.issues.length > 0 ? (
                <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
                  {preview.issues.map((issue, index) => (
                    <p key={index} className="text-muted-foreground">
                      <span className="tabular font-medium text-foreground">
                        {issue.row > 0 ? `Row ${issue.row}` : 'File'}
                      </span>
                      {issue.field ? <span> · {issue.field}</span> : null} — {issue.message}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={reset} disabled={isPending}>
            Cancel
          </Button>
          {preview ? (
            <Button onClick={commit} disabled={isPending || preview.ready === 0}>
              {isPending ? <Loader2Icon className="animate-spin" /> : null}
              Import {preview.ready} {noun}
            </Button>
          ) : (
            <Button onClick={check} disabled={isPending || (csv === '' && workbook === '')}>
              {isPending ? <Loader2Icon className="animate-spin" /> : null}
              Check the file
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DownloadLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} download className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
      <DownloadIcon /> {label}
    </a>
  )
}

function ColumnList({
  title,
  columns,
}: {
  title: string
  columns: { name: string; aliases: string }[]
}) {
  return (
    <div>
      <p className="font-medium text-foreground">{title}</p>
      <ul className="mt-1 space-y-1 text-muted-foreground">
        {columns.map((column) => (
          <li key={column.name}>
            <span className="font-medium text-foreground">{column.name}</span>
            {column.aliases ? <span> — {column.aliases}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
