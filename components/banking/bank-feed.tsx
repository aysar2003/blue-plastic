'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2Icon, Settings2Icon } from 'lucide-react'
import { toast } from 'sonner'

import {
  attachLedgerFile,
  createBankRule,
  excludeTransaction,
  matchFeedBill,
  matchFeedInvoice,
  matchTransaction,
  postFeedLines,
  saveFeedLine,
  suggestionsFor,
  undoFeedLine,
} from '@/app/(app)/banking/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { groupKey } from '@/lib/bank-feed'
import { formatDate } from '@/lib/date'
import { Decimal, formatMoney } from '@/lib/money'
import type { FeedLine } from '@/server/services/bank-feed.service'

type Option = { id: string; name: string }
type Category = { id: string; label: string; type: string }
type OpenDoc = { id: string; number: string; name: string; outstanding: string; date: string }

const COLUMNS = [
  { key: 'reference', label: 'Reference' },
  { key: 'payee', label: 'Payee' },
  { key: 'category', label: 'Category' },
  { key: 'spent', label: 'Spent' },
  { key: 'received', label: 'Received' },
  { key: 'files', label: 'File' },
] as const

type ColumnKey = (typeof COLUMNS)[number]['key']

function loadColumns(): Record<ColumnKey, boolean> {
  const base = { reference: true, payee: true, category: true, spent: true, received: true, files: true }
  if (typeof window === 'undefined') return base
  try {
    const stored = window.localStorage.getItem('bp-feed-columns')
    return stored ? { ...base, ...JSON.parse(stored) } : base
  } catch {
    return base
  }
}

export function BankFeed({
  accountId,
  currency,
  lines,
  categories,
  vendors,
  customers,
  invoices,
  bills,
}: {
  accountId: string
  currency: string
  lines: FeedLine[]
  categories: Category[]
  vendors: Option[]
  customers: Option[]
  invoices: OpenDoc[]
  bills: OpenDoc[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [columns, setColumns] = useState(loadColumns)
  const [group, setGroup] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [openMatch, setOpenMatch] = useState<string | null>(null)
  const [bookMatches, setBookMatches] = useState<
    { journalLineId: string; journalNumber: string; description: string | null; amount: string }[]
  >([])

  const waiting = lines.filter((line) => line.status === 'PENDING')
  const done = lines.filter((line) => line.status !== 'PENDING')
  const shown = useMemo(() => {
    if (!group) return waiting.map((line) => ({ key: line.id, title: null as string | null, rows: [line] }))
    const buckets = new Map<string, FeedLine[]>()
    for (const line of waiting) {
      const key = groupKey(line.description)
      buckets.set(key, [...(buckets.get(key) ?? []), line])
    }
    return [...buckets.entries()].map(([key, rows]) => ({ key, title: key, rows }))
  }, [group, waiting])

  function toggleColumn(key: ColumnKey) {
    setColumns((current) => {
      const next = { ...current, [key]: !current[key] }
      window.localStorage.setItem('bp-feed-columns', JSON.stringify(next))
      return next
    })
  }

  function post(ids: string[]) {
    startTransition(async () => {
      const result = await postFeedLines({ ids })
      if (result.ok) {
        toast.success(`${result.data.posted} posted.`)
        setPicked([])
        router.refresh()
      } else toast.error(result.error.message)
    })
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2">
          <p className="text-sm font-semibold text-primary">To post ({waiting.length})</p>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={group} onChange={(event) => setGroup(event.target.checked)} />
            Group similar
          </label>
          <details className="relative ml-auto">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary">
              <Settings2Icon className="size-3.5" /> Columns
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-popover p-2 text-popover-foreground shadow-lg">
              {COLUMNS.map((column) => (
                <label key={column.key} className="flex items-center gap-2 px-1 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={columns[column.key]}
                    onChange={() => toggleColumn(column.key)}
                  />
                  {column.label}
                </label>
              ))}
            </div>
          </details>
          <Button size="sm" disabled={pending || picked.length === 0} onClick={() => post(picked)}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Post selected
          </Button>
        </div>

        {waiting.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nothing waiting on this account.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary/5 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Bank description</th>
                  {columns.reference ? <th className="px-2 py-2">Reference</th> : null}
                  {columns.payee ? <th className="px-2 py-2">Payee</th> : null}
                  {columns.category ? <th className="px-2 py-2">Category</th> : null}
                  {columns.spent ? <th className="px-2 py-2 text-right">Spent</th> : null}
                  {columns.received ? <th className="px-2 py-2 text-right">Received</th> : null}
                  {columns.files ? <th className="px-2 py-2">File</th> : null}
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((bucket) => (
                  <Bucket
                    key={bucket.key}
                    title={bucket.title}
                    rows={bucket.rows}
                    columns={columns}
                    currency={currency}
                    categories={categories}
                    vendors={vendors}
                    customers={customers}
                    invoices={invoices}
                    bills={bills}
                    picked={picked}
                    setPicked={setPicked}
                    pending={pending}
                    accountId={accountId}
                    openMatch={openMatch}
                    setOpenMatch={setOpenMatch}
                    bookMatches={bookMatches}
                    setBookMatches={setBookMatches}
                    onPost={(id) => post([id])}
                    onRefresh={() => router.refresh()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {done.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b px-3 py-2 text-sm font-semibold">Posted and set aside ({done.length})</div>
          <ul className="divide-y">
            {done.map((line) => (
              <li key={line.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="tabular w-24 text-xs text-muted-foreground">{formatDate(line.date)}</span>
                <span className="min-w-0 flex-1 truncate">{line.description}</span>
                <span className="tabular text-sm">{formatMoney(line.amount, currency)}</span>
                {line.status === 'MATCHED' && line.matchedJournalId ? (
                  <Link href={`/journals/${line.matchedJournalId}`} className="text-primary underline-offset-4 hover:underline">
                    <Badge variant="success">{line.matchedTo}</Badge>
                  </Link>
                ) : (
                  <Badge variant="outline">set aside</Badge>
                )}
                {line.status === 'MATCHED' && !line.cleared ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await undoFeedLine({ id: line.id })
                        if (result.ok) router.refresh()
                        else toast.error(result.error.message)
                      })
                    }
                  >
                    Put back
                  </Button>
                ) : null}
                {line.cleared ? (
                  <span className="text-xs text-muted-foreground">Cleared on a reconciliation</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}

function Bucket(props: {
  title: string | null
  rows: FeedLine[]
  columns: Record<ColumnKey, boolean>
  currency: string
  categories: Category[]
  vendors: Option[]
  customers: Option[]
  invoices: OpenDoc[]
  bills: OpenDoc[]
  picked: string[]
  setPicked: (ids: string[]) => void
  pending: boolean
  accountId: string
  openMatch: string | null
  setOpenMatch: (id: string | null) => void
  bookMatches: { journalLineId: string; journalNumber: string; description: string | null; amount: string }[]
  setBookMatches: (rows: { journalLineId: string; journalNumber: string; description: string | null; amount: string }[]) => void
  onPost: (id: string) => void
  onRefresh: () => void
}) {
  const span =
    4 +
    Number(props.columns.reference) +
    Number(props.columns.payee) +
    Number(props.columns.category) +
    Number(props.columns.spent) +
    Number(props.columns.received) +
    Number(props.columns.files)
  return (
    <>
      {props.title ? (
        <tr className="bg-primary/10">
          <td colSpan={span} className="px-3 py-1.5 text-xs font-semibold capitalize text-primary">
            {props.title}
            <button
              type="button"
              className="ml-3 font-medium underline-offset-4 hover:underline"
              onClick={() => {
                const ids = props.rows.map((row) => row.id)
                const all = ids.every((id) => props.picked.includes(id))
                props.setPicked(all ? props.picked.filter((id) => !ids.includes(id)) : [...new Set([...props.picked, ...ids])])
              }}
            >
              select group
            </button>
          </td>
        </tr>
      ) : null}
      {props.rows.map((line) => (
        <FeedRow key={line.id} line={line} {...props} />
      ))}
    </>
  )
}

function FeedRow({
  line,
  columns,
  currency,
  categories,
  vendors,
  customers,
  invoices,
  bills,
  picked,
  setPicked,
  pending,
  accountId,
  openMatch,
  setOpenMatch,
  bookMatches,
  setBookMatches,
  onPost,
  onRefresh,
}: {
  line: FeedLine
} & Omit<Parameters<typeof Bucket>[0], 'title' | 'rows'>) {
  const [, startTransition] = useTransition()
  const amount = new Decimal(line.amount)
  const moneyOut = amount.isNegative()
  const [categoryId, setCategoryId] = useState(line.categoryAccountId ?? line.suggestion?.categoryAccountId ?? '')
  const [vendorId, setVendorId] = useState(line.vendorId ?? line.suggestion?.vendorId ?? '')
  const [customerId, setCustomerId] = useState(line.customerId ?? line.suggestion?.customerId ?? '')
  const [payeeName, setPayeeName] = useState('')
  const choices = categories.filter((category) => (moneyOut ? category.type === 'EXPENSE' : category.type === 'REVENUE'))
  const docs = moneyOut ? bills : invoices

  function remember(next?: { categoryAccountId?: string; vendorId?: string; customerId?: string; payeeName?: string }) {
    startTransition(async () => {
      const result = await saveFeedLine({
        id: line.id,
        categoryAccountId: next?.categoryAccountId ?? categoryId,
        vendorId: next?.vendorId ?? vendorId,
        customerId: next?.customerId ?? customerId,
        payeeName: next?.payeeName ?? payeeName,
      })
      if (!result.ok) toast.error(result.error.message)
      else onRefresh()
    })
  }

  return (
    <>
      <tr className="border-t align-top">
        <td className="px-2 py-2">
          <input
            type="checkbox"
            checked={picked.includes(line.id)}
            onChange={(event) =>
              setPicked(event.target.checked ? [...picked, line.id] : picked.filter((id) => id !== line.id))
            }
          />
        </td>
        <td className="tabular whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">{formatDate(line.date)}</td>
        <td className="max-w-xs px-2 py-2">
          <p className="truncate">{line.description}</p>
          {line.suggestion ? (
            <p className="text-xs text-primary">{line.suggestion.from === 'rule' ? `Rule: ${line.suggestion.label}` : 'Suggested from last time'}</p>
          ) : null}
        </td>
        {columns.reference ? <td className="px-2 py-2 text-xs">{line.reference}</td> : null}
        {columns.payee ? (
          <td className="px-2 py-2">
            {moneyOut ? (
              <div className="space-y-1">
                <NativeSelect
                  value={vendorId}
                  onChange={(event) => {
                    setVendorId(event.target.value)
                    remember({ vendorId: event.target.value })
                  }}
                  className="h-8"
                >
                  <option value="">Payee</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </NativeSelect>
                <input
                  value={payeeName}
                  onChange={(event) => setPayeeName(event.target.value)}
                  onBlur={() => payeeName && remember()}
                  placeholder="Or a new name"
                  className="h-8 w-full rounded-md border bg-transparent px-2 text-xs"
                />
              </div>
            ) : (
              <NativeSelect
                value={customerId}
                onChange={(event) => {
                  setCustomerId(event.target.value)
                  remember({ customerId: event.target.value })
                }}
                className="h-8"
              >
                <option value="">Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </td>
        ) : null}
        {columns.category ? (
          <td className="px-2 py-2">
            <NativeSelect
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value)
                remember({ categoryAccountId: event.target.value })
              }}
              className="h-8 max-w-56"
            >
              <option value="">Category</option>
              {choices.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </NativeSelect>
          </td>
        ) : null}
        {columns.spent ? (
          <td className="numeric tabular px-2 py-2 text-destructive">{moneyOut ? formatMoney(amount.abs(), currency) : ''}</td>
        ) : null}
        {columns.received ? (
          <td className="numeric tabular px-2 py-2">{moneyOut ? '' : formatMoney(amount, currency)}</td>
        ) : null}
        {columns.files ? (
          <td className="px-2 py-2">
            <form action={attachLedgerFile}>
              <input type="hidden" name="importedTransactionId" value={line.id} />
              <input
                type="file"
                name="file"
                accept="application/pdf,image/*"
                className="w-28 text-xs"
                onChange={(event) => {
                  const form = event.currentTarget.form
                  if (form && event.currentTarget.files?.[0]) form.requestSubmit()
                }}
              />
              {line.fileCount > 0 ? <span className="text-xs text-primary">{line.fileCount}</span> : null}
            </form>
          </td>
        ) : null}
        <td className="space-y-1 px-2 py-2 whitespace-nowrap">
          <Button size="sm" disabled={pending || !categoryId} onClick={() => onPost(line.id)}>
            Post
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              startTransition(async () => {
                const result = await createBankRule({
                  name: groupKey(line.description),
                  contains: groupKey(line.description).split(' ')[0] || line.description.slice(0, 20),
                  accountId,
                  categoryAccountId: categoryId,
                  vendorId,
                  customerId,
                })
                if (result.ok) {
                  toast.success('Rule saved.')
                  onRefresh()
                } else toast.error(result.error.message)
              })
            }
          >
            Rule
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpenMatch(openMatch === line.id ? null : line.id)
              startTransition(async () => setBookMatches(await suggestionsFor(line.id)))
            }}
          >
            Match
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              startTransition(async () => {
                const result = await excludeTransaction({ importedId: line.id })
                if (result.ok) onRefresh()
                else toast.error(result.error.message)
              })
            }
          >
            Aside
          </Button>
        </td>
      </tr>
      {openMatch === line.id ? (
        <tr className="bg-muted/30">
          <td colSpan={8} className="px-3 py-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-primary">
                  {moneyOut ? 'Open bills' : 'Open invoices'}
                </p>
                <ul className="space-y-1">
                  {docs.length === 0 ? <li className="text-xs text-muted-foreground">None open.</li> : null}
                  {docs.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate">
                        {doc.number} · {doc.name}
                      </span>
                      <span className="tabular">{doc.outstanding}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          startTransition(async () => {
                            const result = moneyOut
                              ? await matchFeedBill({ importedId: line.id, billId: doc.id })
                              : await matchFeedInvoice({ importedId: line.id, invoiceId: doc.id })
                            if (result.ok) onRefresh()
                            else toast.error(result.error.message)
                          })
                        }
                      >
                        Apply
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Already in the books</p>
                <ul className="space-y-1">
                  {bookMatches.length === 0 ? (
                    <li className="text-xs text-muted-foreground">No exact amount within a week.</li>
                  ) : (
                    bookMatches.map((match) => (
                      <li key={match.journalLineId} className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate">
                          {match.journalNumber} · {match.description}
                        </span>
                        <span className="tabular">{formatMoney(match.amount, currency)}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            startTransition(async () => {
                              const result = await matchTransaction({
                                importedId: line.id,
                                journalLineId: match.journalLineId,
                              })
                              if (result.ok) onRefresh()
                              else toast.error(result.error.message)
                            })
                          }
                        >
                          Match
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}
