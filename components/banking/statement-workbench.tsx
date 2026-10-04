'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangleIcon, CheckCircle2Icon, Loader2Icon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Card } from '@/components/ui/card'
import { previewStatement, runStatementImport } from '@/app/(app)/banking/actions'

/**
 * Importing a statement, then deciding what each line is.
 *
 * Suggestions require an **exact** amount match within a few days. A near-match is
 * not a match — it is two different transactions, and offering it would let a
 * reconciliation quietly bury a real discrepancy.
 */
export function StatementWorkbench({
  accounts,
  accountId,
  columns,
}: {
  accounts: { id: string; label: string }[]
  accountId: string
  columns: { name: string; required: boolean; aliases: string }[]
}) {
  const router = useRouter()
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<{
    total: number
    ready: number
    duplicates: number
    issues: { row: number; message: string }[]
    sample: { date: string; description: string; amount: string }[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-[16rem_1fr]">
          <div>
            <label htmlFor="account" className="mb-1.5 block text-sm font-medium">
              Account
            </label>
            <NativeSelect
              id="account"
              value={accountId}
              onChange={(event) => router.push(`/banking/import?account=${event.target.value}`)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <label htmlFor="statement-file" className="mb-1.5 block text-sm font-medium">
              Statement CSV
            </label>
            <input
              id="statement-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => {
                  setCsv(String(reader.result ?? ''))
                  setPreview(null)
                }
                reader.readAsText(file)
              }}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          </div>
        </div>

        <details className="mt-4 rounded-md border bg-muted/30 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Columns it understands</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {columns.map((column) => (
              <li key={column.name}>
                <span className="font-medium text-foreground">{column.name}</span>
                {column.required ? <span className="text-destructive"> (required)</span> : null}
                {column.aliases ? <span> — {column.aliases}</span> : null}
              </li>
            ))}
          </ul>
        </details>

        {error ? (
          <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {preview ? (
          <div className="mt-4 space-y-2 rounded-md border p-3 text-sm">
            <div className="flex flex-wrap gap-4">
              <span className="flex items-center gap-1.5 text-success">
                <CheckCircle2Icon className="size-4" />
                <span className="tabular font-medium">{preview.ready}</span> new
              </span>
              {preview.duplicates > 0 ? (
                <span className="text-muted-foreground">
                  <span className="tabular font-medium">{preview.duplicates}</span> already imported
                </span>
              ) : null}
              {preview.issues.length > 0 ? (
                <span className="flex items-center gap-1.5 text-warning-foreground dark:text-warning">
                  <AlertTriangleIcon className="size-4" />
                  <span className="tabular font-medium">{preview.issues.length}</span> unreadable
                </span>
              ) : null}
            </div>
            {preview.sample.length > 0 ? (
              <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                {preview.sample.map((row, index) => (
                  <li key={index}>
                    <span className="tabular">{row.date}</span> — {row.description}{' '}
                    <span className="tabular">{row.amount}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          {preview ? (
            <Button
              disabled={isPending || preview.ready === 0}
              onClick={() =>
                startTransition(async () => {
                  const result = await runStatementImport({ accountId, csv })
                  if (result.ok) {
                    toast.success(`${result.data.imported} lines imported.`)
                    setPreview(null)
                    setCsv('')
                    router.refresh()
                  } else {
                    setError(result.error.message)
                  }
                })
              }
            >
              {isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
              Import {preview.ready} lines
            </Button>
          ) : (
            <Button
              disabled={isPending || csv === '' || accountId === ''}
              onClick={() =>
                startTransition(async () => {
                  setError(null)
                  const result = await previewStatement({ accountId, csv })
                  if (result.ok) setPreview(result.data)
                  else setError(result.error.message)
                })
              }
            >
              {isPending ? <Loader2Icon className="animate-spin" /> : null}
              Check the file
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
