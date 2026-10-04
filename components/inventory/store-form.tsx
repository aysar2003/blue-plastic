'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { createStore } from '@/app/(app)/inventory/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Names a store and the inventory account that is created with it. */
export function StoreForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const result = await createStore({ name })
          if (result.ok) {
            toast.success(`${result.data.name} added, with its inventory account.`)
            setName('')
            router.refresh()
          } else {
            toast.error(result.error.message)
          }
        })
      }}
    >
      <label className="grid gap-1 text-sm">
        Store name
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Main warehouse"
          required
          className="w-64"
        />
      </label>
      <Button type="submit" disabled={pending || name.trim() === ''}>
        {pending ? 'Adding…' : 'Add store'}
      </Button>
    </form>
  )
}
