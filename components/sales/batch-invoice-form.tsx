'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { createBatchInvoices } from '@/app/(app)/sales/actions'
import { Field } from '@/components/forms/field'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'

type Person = { id: string; displayName: string }
type ItemOption = { id: string; name: string; sku: string | null }
type TaxOption = { id: string; name: string }

type Row = {
  customerId: string
  customerName: string
  ok: boolean
  id?: string
  number?: string
  message?: string
}

/**
 * The same invoice, written once for each ticked customer. Failures (a credit
 * limit, an archived item) stay on the list so the ones that posted are not lost.
 */
export function BatchInvoiceForm({
  customers,
  items,
  taxCodes,
  today,
}: {
  customers: Person[]
  items: ItemOption[]
  taxCodes: TaxOption[]
  today: string
}) {
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [date, setDate] = useState(today)
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [itemId, setItemId] = useState(items[0]?.id ?? '')
  const [taxCodeId, setTaxCodeId] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [pending, start] = useTransition()

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return customers
    return customers.filter((customer) => customer.displayName.toLowerCase().includes(needle))
  }, [customers, query])

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const canSave = chosen.size > 0 && itemId !== '' && unitPrice.trim() !== '' && !pending

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        start(async () => {
          const result = await createBatchInvoices({
            customerIds: [...chosen],
            date,
            description,
            quantity: quantity.trim() || '1',
            unitPrice,
            itemId,
            taxCodeId,
          })
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          setRows(result.data.rows)
          const failed = result.data.rows.filter((row) => !row.ok).length
          const posted = result.data.rows.length - failed
          toast.success(
            failed === 0
              ? `${posted} ${posted === 1 ? 'invoice' : 'invoices'} created.`
              : `${posted} created, ${failed} not created.`,
          )
        })
      }}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <CardContent className="space-y-3 p-4">
            <Field name="customers" label="Customers" required>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a customer"
                aria-label="Find a customer"
              />
              <div className="mt-2 max-h-80 space-y-1 overflow-y-auto rounded-md border p-2">
                {visible.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-muted-foreground">No customers match.</p>
                ) : (
                  visible.map((customer) => (
                    <label key={customer.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={chosen.has(customer.id)}
                        onChange={() => toggle(customer.id)}
                      />
                      <span>{customer.displayName}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">{chosen.size} selected</p>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <Field name="date" label="Invoice date" required>
              <DateField id="date" value={date} onChange={setDate} today={today} required />
            </Field>
            <Field name="itemId" label="Item" required>
              <select
                id="itemId"
                className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm"
                value={itemId}
                onChange={(event) => setItemId(event.target.value)}
                required
              >
                {items.length === 0 ? <option value="">No items</option> : null}
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku ? `${item.sku} — ${item.name}` : item.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="quantity" label="Quantity" required>
                <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" />
              </Field>
              <Field name="unitPrice" label="Unit price" required>
                <Input value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} inputMode="decimal" />
              </Field>
            </div>
            <Field name="description" label="Description">
              <Input value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
            {taxCodes.length > 0 ? (
              <Field name="taxCodeId" label="Tax code">
                <select
                  id="taxCodeId"
                  className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm"
                  value={taxCodeId}
                  onChange={(event) => setTaxCodeId(event.target.value)}
                >
                  <option value="">Item’s own tax</option>
                  {taxCodes.map((code) => (
                    <option key={code.id} value={code.id}>
                      {code.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!canSave}>
          {pending ? 'Creating…' : chosen.size === 1 ? 'Create invoice' : `Create ${chosen.size} invoices`}
        </Button>
      </div>

      {rows ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-medium">Results</p>
            <ul className="space-y-1 text-sm">
              {rows.map((row) => (
                <li key={row.customerId} className={row.ok ? '' : 'text-destructive'}>
                  {row.ok && row.id ? (
                    <>
                      <Link href={`/sales/invoices/${row.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                        {row.number}
                      </Link>{' '}
                      {row.customerName}
                    </>
                  ) : (
                    <>
                      {row.customerName}: {row.message}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </form>
  )
}
