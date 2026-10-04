'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { createStore, updateStore } from '@/app/(app)/inventory/actions'
import { Field } from '@/components/forms/field'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export type StoreFormValues = {
  id?: string
  name?: string
  address?: string | null
  phone?: string | null
  keyHolderName?: string | null
  keyHolderPhone?: string | null
  notes?: string | null
}

/** Full store registration — name, address, phone, and who holds the key. */
export function StoreForm({
  mode = 'create',
  initial,
  cancelHref = '/stores',
}: {
  mode?: 'create' | 'edit'
  initial?: StoreFormValues
  cancelHref?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(initial?.name ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [keyHolderName, setKeyHolderName] = useState(initial?.keyHolderName ?? '')
  const [keyHolderPhone, setKeyHolderPhone] = useState(initial?.keyHolderPhone ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  return (
    <form
      className="mx-auto max-w-2xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const payload = {
            name,
            address,
            phone,
            keyHolderName,
            keyHolderPhone,
            notes,
          }
          const result =
            mode === 'edit' && initial?.id
              ? await updateStore({ id: initial.id, ...payload })
              : await createStore(payload)
          if (result.ok) {
            toast.success(
              mode === 'edit'
                ? `${result.data.name} updated.`
                : `${result.data.name} added, with its inventory account.`,
            )
            router.push(`/stores/${result.data.id}`)
            router.refresh()
          } else {
            toast.error(result.error.message)
          }
        })
      }}
    >
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <Field name="name" label="Store name" required className="sm:col-span-2">
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Main warehouse"
              required
              autoFocus
            />
          </Field>

          <Field
            name="address"
            label="Address"
            hint="Street, area, or landmark for this store."
            className="sm:col-span-2"
          >
            <Input
              id="address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Bakaro market, stall 12"
            />
          </Field>

          <Field name="phone" label="Store phone" hint="Number to call the store itself.">
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0612 000 000"
            />
          </Field>

          <div className="hidden sm:block" />

          <Field
            name="keyHolderName"
            label="Key holder"
            hint="Person who keeps the physical key — so the system knows who has access."
          >
            <Input
              id="keyHolderName"
              value={keyHolderName}
              onChange={(event) => setKeyHolderName(event.target.value)}
              placeholder="Ahmed Hassan"
            />
          </Field>

          <Field name="keyHolderPhone" label="Key holder phone">
            <Input
              id="keyHolderPhone"
              type="tel"
              value={keyHolderPhone}
              onChange={(event) => setKeyHolderPhone(event.target.value)}
              placeholder="0615 000 000"
            />
          </Field>

          <Field name="notes" label="Notes" className="sm:col-span-2">
            <Input
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional — opening hours, spare key location…"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={() => router.push(cancelHref)}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || name.trim() === ''}>
          {pending ? (mode === 'edit' ? 'Saving…' : 'Adding…') : mode === 'edit' ? 'Save store' : 'Add store'}
        </Button>
      </div>
    </form>
  )
}
