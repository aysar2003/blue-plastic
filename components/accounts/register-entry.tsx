'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { enterOnRegister } from '@/app/(app)/banking/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateField } from '@/components/ui/date-field'
import { NativeSelect } from '@/components/ui/native-select'

export function RegisterEntry({
  accountId,
  today,
  categories,
}: {
  accountId: string
  today: string
  categories: { id: string; label: string; type: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [direction, setDirection] = useState<'out' | 'in'>('out')
  const [date, setDate] = useState(today)
  const choices = categories.filter((category) => (direction === 'out' ? category.type === 'EXPENSE' : category.type === 'REVENUE'))

  return (
    <form
      className="mb-4 grid gap-2 rounded-xl border border-primary/15 bg-primary/5 p-3 md:grid-cols-[8rem_9rem_1fr_1fr_8rem_auto]"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        startTransition(async () => {
          const result = await enterOnRegister({
            accountId,
            direction,
            date,
            amount: String(data.get('amount') ?? ''),
            categoryAccountId: String(data.get('categoryAccountId') ?? ''),
            payeeName: String(data.get('payeeName') ?? ''),
            memo: String(data.get('memo') ?? ''),
          })
          if (result.ok) {
            toast.success('Recorded.')
            event.currentTarget.reset()
            router.refresh()
          } else toast.error(result.error.message)
        })
      }}
    >
      <NativeSelect value={direction} onChange={(event) => setDirection(event.target.value as 'out' | 'in')} className="h-9">
        <option value="out">Money out</option>
        <option value="in">Money in</option>
      </NativeSelect>
      <DateField id="register-date" name="date" value={date} onChange={setDate} today={today} />
      <input name="payeeName" placeholder={direction === 'out' ? 'Who was paid' : 'Memo name'} className="h-9 rounded-md border bg-white/80 px-2 text-sm" />
      <NativeSelect name="categoryAccountId" className="h-9" defaultValue="">
        <option value="">Category</option>
        {choices.map((category) => (
          <option key={category.id} value={category.id}>
            {category.label}
          </option>
        ))}
      </NativeSelect>
      <Input name="amount" inputMode="decimal" placeholder="0.00" required className="tabular h-9 rounded-md border bg-white/80 px-2 text-sm" />
      <input name="memo" type="hidden" value="" />
      <Button type="submit" size="sm" disabled={pending}>
        Add
      </Button>
    </form>
  )
}
