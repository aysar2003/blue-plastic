'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { saveReportNote } from '@/app/(app)/workspace/actions'
import { Button } from '@/components/ui/button'

export function ReportNote({ reportKey, initial }: { reportKey: 'profit-loss' | 'balance-sheet'; initial: string }) {
  const [body, setBody] = useState(initial)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="mb-4 rounded-xl border border-primary/15 bg-primary/5 p-3"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const result = await saveReportNote({ reportKey, body })
          if (result.ok) toast.success('Note saved.')
          else toast.error(result.error.message)
        })
      }}
    >
      <label htmlFor={`${reportKey}-note`} className="text-xs font-semibold text-primary">
        Note on this report
      </label>
      <textarea
        id={`${reportKey}-note`}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={2}
        maxLength={2000}
        className="mt-1 w-full resize-y rounded-md border bg-white/80 px-2 py-1.5 text-sm"
        placeholder="A reminder for the next time you open this report."
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" type="submit" disabled={pending}>
          Save note
        </Button>
      </div>
    </form>
  )
}
