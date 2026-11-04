'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { createFixedAssetCategory } from '../actions'

export function CategoryForm({
  accounts,
}: {
  accounts: { id: string; code: string; name: string; type: string }[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState('')
  const [usefulLifeMonths, setUsefulLifeMonths] = useState('60')
  const [assetAccountId, setAssetAccountId] = useState('')
  const [accumDepAccountId, setAccumDepAccountId] = useState('')
  const [expenseAccountId, setExpenseAccountId] = useState('')

  const options = accounts.map((a) => (
    <option key={a.id} value={a.id}>
      {a.code} · {a.name}
    </option>
  ))

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        start(async () => {
          const result = await createFixedAssetCategory({
            name,
            usefulLifeMonths: Number(usefulLifeMonths),
            assetAccountId,
            accumDepAccountId,
            expenseAccountId,
          })
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          toast.success('Category saved.')
          setName('')
          router.refresh()
        })
      }}
    >
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" required />
      </div>
      <div>
        <Label>Useful life (months)</Label>
        <Input
          value={usefulLifeMonths}
          onChange={(e) => setUsefulLifeMonths(e.target.value)}
          className="mt-1"
          required
        />
      </div>
      <div>
        <Label>Cost account</Label>
        <select
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          value={assetAccountId}
          onChange={(e) => setAssetAccountId(e.target.value)}
          required
        >
          <option value="">—</option>
          {options}
        </select>
      </div>
      <div>
        <Label>Accumulated depreciation</Label>
        <select
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          value={accumDepAccountId}
          onChange={(e) => setAccumDepAccountId(e.target.value)}
          required
        >
          <option value="">—</option>
          {options}
        </select>
      </div>
      <div>
        <Label>Depreciation expense</Label>
        <select
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          value={expenseAccountId}
          onChange={(e) => setExpenseAccountId(e.target.value)}
          required
        >
          <option value="">—</option>
          {options}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Add category'}
      </Button>
    </form>
  )
}
