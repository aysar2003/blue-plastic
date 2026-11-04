'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { createFixedAsset } from '../actions'

export function NewAssetForm({
  categories,
  today,
}: {
  categories: { id: string; name: string; usefulLifeMonths: number }[]
  today: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [acquiredOn, setAcquiredOn] = useState(today)
  const [cost, setCost] = useState('')
  const [salvageValue, setSalvageValue] = useState('0')

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        start(async () => {
          const result = await createFixedAsset({
            categoryId,
            number,
            name,
            acquiredOn,
            cost,
            salvageValue,
          })
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          toast.success(`${result.data.number} saved.`)
          router.push('/accounting/fixed-assets')
          router.refresh()
        })
      }}
    >
      <div>
        <Label>Category</Label>
        <select
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.usefulLifeMonths} mo)
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Number</Label>
        <Input value={number} onChange={(e) => setNumber(e.target.value)} className="mt-1" required />
      </div>
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" required />
      </div>
      <div>
        <Label>Acquired on</Label>
        <Input type="date" value={acquiredOn} onChange={(e) => setAcquiredOn(e.target.value)} className="mt-1" required />
      </div>
      <div>
        <Label>Cost</Label>
        <Input value={cost} onChange={(e) => setCost(e.target.value)} className="mt-1 tabular" required />
      </div>
      <div>
        <Label>Salvage</Label>
        <Input value={salvageValue} onChange={(e) => setSalvageValue(e.target.value)} className="mt-1 tabular" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save asset'}
      </Button>
    </form>
  )
}
