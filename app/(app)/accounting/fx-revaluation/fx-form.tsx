'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { runFxRevaluation } from './actions'

export function FxRevaluationForm({
  currencies,
  baseCurrency,
}: {
  currencies: string[]
  baseCurrency: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [currencyCode, setCurrencyCode] = useState(currencies[0] ?? '')
  const [newRate, setNewRate] = useState('1')

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        start(async () => {
          const result = await runFxRevaluation({ currencyCode, newRate })
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          if (!result.data.posted) {
            toast.message('Nothing to revalue at that rate.')
          } else {
            toast.success(`Revaluation posted (${result.data.lines} lines).`)
            router.push(`/journals/${result.data.journalId}`)
          }
          router.refresh()
        })
      }}
    >
      <div>
        <Label htmlFor="currencyCode">Currency</Label>
        <select
          id="currencyCode"
          value={currencyCode}
          onChange={(event) => setCurrencyCode(event.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          {currencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="newRate">New rate ({baseCurrency} per 1 {currencyCode})</Label>
        <Input
          id="newRate"
          value={newRate}
          onChange={(event) => setNewRate(event.target.value)}
          inputMode="decimal"
          className="mt-1 tabular"
        />
      </div>
      <Button type="submit" disabled={pending || !currencyCode}>
        {pending ? 'Posting…' : 'Post revaluation'}
      </Button>
    </form>
  )
}
