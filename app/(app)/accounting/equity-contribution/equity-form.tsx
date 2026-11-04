'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { postEquityContribution } from './actions'

export function EquityContributionForm({
  baseCurrency,
  banks,
  today,
}: {
  baseCurrency: string
  banks: { id: string; code: string; name: string }[]
  today: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [bankAccountId, setBankAccountId] = useState(banks[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [memo, setMemo] = useState('')

  if (banks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a bank account on the chart before recording a contribution.
      </p>
    )
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        start(async () => {
          const result = await postEquityContribution({
            bankAccountId,
            amount,
            date,
            memo: memo || null,
          })
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          toast.success(`Posted ${result.data.journalNumber}.`)
          router.push(`/journals/${result.data.journalId}`)
          router.refresh()
        })
      }}
    >
      <div>
        <Label htmlFor="bankAccountId">Bank / cash account</Label>
        <select
          id="bankAccountId"
          value={bankAccountId}
          onChange={(event) => setBankAccountId(event.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          required
        >
          {banks.map((bank) => (
            <option key={bank.id} value={bank.id}>
              {bank.code} · {bank.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="amount">Amount ({baseCurrency})</Label>
        <Input
          id="amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          className="mt-1 tabular"
          required
        />
      </div>
      <div>
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="mt-1"
          required
        />
      </div>
      <div>
        <Label htmlFor="memo">Memo</Label>
        <Input id="memo" value={memo} onChange={(event) => setMemo(event.target.value)} className="mt-1" />
      </div>
      <Button type="submit" disabled={pending || !bankAccountId || !amount}>
        {pending ? 'Posting…' : 'Post contribution'}
      </Button>
    </form>
  )
}
