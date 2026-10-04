'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, PrinterIcon, SaveIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { AccountPicker } from '@/components/forms/account-picker'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { DateField } from '@/components/ui/date-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { AccountPickerOption, PartyRequirement } from '@/lib/account-options'
import { formatDate } from '@/lib/date'
import { Decimal, formatMoney, parseMoneyInput } from '@/lib/money'
import { cn } from '@/lib/utils'
import { findJournals, postManualJournalForm } from '../actions'

export type PartyOption = { id: string; label: string; hint?: string; balance?: string | null }

/** One posted line in the list under the form. */
export type JournalRegisterLine = {
  lineId: string
  journalId: string
  date: string
  number: string
  adjusting: boolean
  manual: boolean
  account: string
  memo: string | null
  amount: string
}

/**
 * A name on a line is one value, not two fields.
 *
 * The ledger stores a customer id and a vendor id separately, because they point
 * at different tables and a receivables line must carry the first while a
 * payables line must carry the second. But nobody choosing a name thinks in those
 * terms — they think "Ahmed Trading". So the picker offers one list under two
 * headings and the side it came from is remembered here.
 */
type PartyValue = { kind: 'customer' | 'vendor'; id: string } | null

const partyKey = (value: PartyValue) => (value ? `${value.kind}:${value.id}` : null)

const parsePartyKey = (key: string | null): PartyValue => {
  if (!key) return null
  const [kind, id] = key.split(':')
  return kind === 'customer' || kind === 'vendor' ? { kind, id } : null
}

/** The one customer or vendor named on the entry, when every named line agrees. */
function soleParty(lines: Line[], kind: 'customer' | 'vendor'): PartyValue {
  let found: PartyValue = null
  for (const line of lines) {
    if (line.party?.kind !== kind) continue
    if (found && found.id !== line.party.id) return null
    found = line.party
  }
  return found
}

/**
 * The name that will be posted. A receivables line takes the customer already
 * named anywhere on the entry, and a payables line takes the vendor, so naming
 * them on the bank line is enough.
 */
function partyForLine(line: Line, lines: Line[], requires: PartyRequirement): PartyValue {
  if (requires === 'customer') {
    if (line.party?.kind === 'customer') return line.party
    if (line.party) return line.party
    return soleParty(lines, 'customer')
  }
  if (requires === 'vendor') {
    if (line.party?.kind === 'vendor') return line.party
    if (line.party) return line.party
    return soleParty(lines, 'vendor')
  }
  return line.party
}

type Line = {
  key: number
  accountId: string
  debit: string
  credit: string
  description: string
  party: PartyValue
}

const ROW_COUNT = 10

const EMPTY = (key: number): Line => ({
  key,
  accountId: '',
  debit: '',
  credit: '',
  description: '',
  party: null,
})

const blankLines = () => Array.from({ length: ROW_COUNT }, (_, index) => EMPTY(index + 1))

const CURRENCY_LABEL: Record<string, string> = {
  USD: 'US Dollar',
  SOS: 'Somali Shilling',
  EUR: 'Euro',
  GBP: 'British Pound',
  KES: 'Kenyan Shilling',
  AED: 'UAE Dirham',
}

const lineInput =
  'h-7 rounded-none border-transparent bg-transparent px-1.5 shadow-none focus-visible:border-[#3A7CA8] focus-visible:bg-white focus-visible:ring-0'

/**
 * The one screen where a person chooses both sides of an entry.
 *
 * The grid follows the journal people already know: account, debit, credit,
 * a memo on the line, and a name that is a customer or a vendor. Receivables
 * still require a customer and payables a vendor — that is what keeps the
 * aging report and the control account on the same rows.
 */
export function JournalEntryForm({
  accounts,
  customers,
  vendors,
  entryNumber,
  today,
  currency,
  register,
}: {
  accounts: AccountPickerOption[]
  customers: PartyOption[]
  vendors: PartyOption[]
  /** The number this entry will take. A preview — see `peekDocumentNumber`. */
  entryNumber: string
  today: string
  currency: string
  register: JournalRegisterLine[]
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(postManualJournalForm, idleState)
  const [number, setNumber] = useState(entryNumber)
  const [lines, setLines] = useState<Line[]>(blankLines)
  const [date, setDate] = useState(today)
  const [memo, setMemo] = useState('')
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [listOpen, setListOpen] = useState(true)
  const [listFilter, setListFilter] = useState<'all' | 'manual' | 'adjusting'>('all')
  const nextKey = useRef(ROW_COUNT + 1)
  const attempt = useRef(0)
  const handledAttempt = useRef(0)
  const afterSave = useRef<'close' | 'new'>('close')

  useEffect(() => setNumber(entryNumber), [entryNumber])

  useEffect(() => {
    if (state.status === 'success' && handledAttempt.current !== attempt.current) {
      handledAttempt.current = attempt.current
      toast.success(state.message ?? 'Journal posted.')
      if (afterSave.current === 'new') {
        setMemo('')
        setIsAdjusting(false)
        setDate(today)
        setLines(blankLines())
        nextKey.current = ROW_COUNT + 1
        router.refresh()
        return
      }
      router.push('/journals')
      router.refresh()
    }
  }, [state, router, today])

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  )

  /** Customers and vendors in one list, each under its own heading. */
  const partyOptions = useMemo(
    () => [
      ...customers.map((party) => ({
        value: `customer:${party.id}`,
        label: party.label,
        hint: party.hint,
        group: 'Customers',
      })),
      ...vendors.map((party) => ({
        value: `vendor:${party.id}`,
        label: party.label,
        hint: party.hint,
        group: 'Vendors',
      })),
    ],
    [customers, vendors],
  )

  const customerOptions = useMemo(
    () => partyOptions.filter((option) => option.value.startsWith('customer:')),
    [partyOptions],
  )
  const vendorOptions = useMemo(
    () => partyOptions.filter((option) => option.value.startsWith('vendor:')),
    [partyOptions],
  )

  const totals = useMemo(() => {
    let debit = new Decimal(0)
    let credit = new Decimal(0)
    for (const line of lines) {
      debit = debit.plus(parseMoneyInput(line.debit) ?? 0)
      credit = credit.plus(parseMoneyInput(line.credit) ?? 0)
    }
    return { debit, credit, difference: debit.minus(credit) }
  }, [lines])

  const filled = lines.filter((line) => line.accountId && (line.debit !== '' || line.credit !== ''))

  // The same rules the service applies, said here so the button can explain why
  // it is unavailable rather than the server explaining it after the fact.
  const wrongParty = filled.find((line) => {
    const requires = requirementOf(accountsById.get(line.accountId))
    if (!requires) return false
    return partyForLine(line, lines, requires)?.kind !== requires
  })

  const balanced = totals.difference.isZero() && !totals.debit.isZero()
  const canPost = balanced && filled.length >= 2 && memo.trim() !== '' && !wrongParty

  const listed = register.filter((line) =>
    listFilter === 'manual' ? line.manual : listFilter === 'adjusting' ? line.adjusting : true,
  )

  const update = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))

  /** Changing the account drops a name of the wrong kind for the new account. */
  const chooseAccount = (line: Line, accountId: string | null) => {
    const requires = requirementOf(accountsById.get(accountId ?? ''))
    update(line.key, {
      accountId: accountId ?? '',
      party: requires && line.party?.kind !== requires ? null : line.party,
    })
  }

  const revert = () => {
    setNumber(entryNumber)
    setDate(today)
    setMemo('')
    setIsAdjusting(false)
    setLines(blankLines())
    nextKey.current = ROW_COUNT + 1
  }

  const markSave = (next: 'close' | 'new') => {
    attempt.current += 1
    afterSave.current = next
  }

  const payload = JSON.stringify({
    number,
    date,
    memo,
    isAdjusting,
    lines: filled.map((line) => {
      const party = partyForLine(line, lines, requirementOf(accountsById.get(line.accountId)))
      return {
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
        customerId: party?.kind === 'customer' ? party.id : null,
        vendorId: party?.kind === 'vendor' ? party.id : null,
      }
    }),
  })

  const currencyName = CURRENCY_LABEL[currency] ?? currency

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="payload" value={payload} />

      <div className="flex flex-wrap items-center gap-1.5 print:hidden">
        <JournalFinder currency={currency} />
        <Button type="button" variant="outline" size="sm" onClick={revert}>
          <PlusIcon />
          New
        </Button>
        <SubmitButton
          variant="outline"
          size="sm"
          disabled={!canPost}
          pendingLabel="Saving…"
          onClick={() => markSave('close')}
        >
          <SaveIcon />
          Save
        </SubmitButton>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <PrinterIcon />
          Print
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setListOpen((open) => !open)}>
          {listOpen ? 'Hide list' : 'Show list'}
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-3 p-3">
          <FormStatus state={state} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[11rem_11rem_11rem_auto]">
            <Field name="currency" label="Currency">
              <Input id="currency" value={currencyName} readOnly tabIndex={-1} className="bg-muted/40" />
            </Field>

            <Field name="date" label="Date" required error={state.fieldErrors?.date}>
              <DateField
                id="date"
                value={date}
                onChange={setDate}
                today={today}
                required
                aria-invalid={state.fieldErrors?.date ? true : undefined}
              />
            </Field>

            <Field
              name="number"
              label="Entry no."
              error={state.fieldErrors?.number}
              hint="Type the number you want, or leave the next one."
            >
              <Input
                id="number"
                name="number"
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                className="tabular"
                maxLength={40}
                autoComplete="off"
                aria-invalid={state.fieldErrors?.number ? true : undefined}
              />
            </Field>

            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={isAdjusting}
                onChange={(event) => setIsAdjusting(event.target.checked)}
                className="size-4 rounded border-input"
              />
              Adjusting entry
            </label>
          </div>

          <Field
            name="memo"
            label="Memo"
            required
            error={state.fieldErrors?.memo}
            hint="What this entry records. It appears on the register and on reports."
          >
            <Input
              {...fieldProps('memo', state.fieldErrors?.memo, true)}
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="What this entry is for"
              required
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#e8ebef] text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <th className="min-w-56 px-2 py-1.5 text-left">Account</th>
                <th className="w-32 px-2 py-1.5 text-right">Debit ({currency})</th>
                <th className="w-32 px-2 py-1.5 text-right">Credit ({currency})</th>
                <th className="min-w-40 px-2 py-1.5 text-left">Memo</th>
                <th className="min-w-52 px-2 py-1.5 text-left">Name</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const account = accountsById.get(line.accountId)
                const requires = requirementOf(account)
                const party = partyForLine(line, lines, requires)
                const partyRecord =
                  party?.kind === 'customer'
                    ? customers.find((row) => row.id === party.id)
                    : party?.kind === 'vendor'
                      ? vendors.find((row) => row.id === party.id)
                      : undefined
                const options =
                  requires === 'customer'
                    ? customerOptions
                    : requires === 'vendor'
                      ? vendorOptions
                      : partyOptions

                return (
                  <tr
                    key={line.key}
                    className={cn('align-middle', index % 2 === 1 ? 'bg-[#e7f3fb]' : 'bg-white')}
                  >
                    <td className="px-1 py-0.5">
                      <AccountPicker
                        options={accounts}
                        value={line.accountId || null}
                        onChange={(next) => chooseAccount(line, next)}
                        placeholder="Account"
                        clearable
                      />
                      {account?.subtype === 'BANK' && account.balance != null ? (
                        <span className="mt-0.5 block px-1.5 text-xs tabular text-muted-foreground">
                          Balance {formatMoney(account.balance, currency)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-1 py-0.5">
                      <Input
                        aria-label="Debit"
                        inputMode="decimal"
                        className={cn(lineInput, 'tabular text-right')}
                        value={line.debit}
                        onChange={(event) =>
                          update(line.key, { debit: event.target.value, credit: '' })
                        }
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <Input
                        aria-label="Credit"
                        inputMode="decimal"
                        className={cn(lineInput, 'tabular text-right')}
                        value={line.credit}
                        onChange={(event) =>
                          update(line.key, { credit: event.target.value, debit: '' })
                        }
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <Input
                        aria-label="Line memo"
                        className={lineInput}
                        value={line.description}
                        onChange={(event) => update(line.key, { description: event.target.value })}
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <Combobox
                        options={options}
                        value={partyKey(party)}
                        onChange={(next) => update(line.key, { party: parsePartyKey(next) })}
                        placeholder={
                          requires === 'customer'
                            ? 'Customer'
                            : requires === 'vendor'
                              ? 'Vendor'
                              : 'Customer or vendor'
                        }
                        emptyMessage="No name matches. Add them under Customers or Vendors."
                        clearable
                        aria-label="Name"
                      />
                      {party?.kind === 'customer' && partyRecord?.balance != null ? (
                        <span className="mt-0.5 block px-1.5 text-xs tabular text-muted-foreground">
                          Owes you {formatMoney(partyRecord.balance, currency)}
                        </span>
                      ) : null}
                      {party?.kind === 'vendor' && partyRecord?.balance != null ? (
                        <span className="mt-0.5 block px-1.5 text-xs tabular text-muted-foreground">
                          You owe {formatMoney(partyRecord.balance, currency)}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-[#f4f5f6] font-medium">
                <td className="px-3 py-2">Totals</td>
                <td className="tabular px-3 py-2 text-right">{formatMoney(totals.debit, currency)}</td>
                <td className="tabular px-3 py-2 text-right">{formatMoney(totals.credit, currency)}</td>
                <td colSpan={2} className="px-3 py-2 text-xs font-normal text-muted-foreground">
                  {!totals.difference.isZero()
                    ? `Out of balance by ${formatMoney(totals.difference.abs(), currency)}`
                    : wrongParty
                      ? `Name the ${
                          requirementOf(accountsById.get(wrongParty.accountId)) === 'customer'
                            ? 'customer'
                            : 'vendor'
                        } on that line`
                      : balanced
                        ? 'Balanced'
                        : 'Enter the amounts'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((current) => [...current, EMPTY(nextKey.current++)])}
          >
            <PlusIcon /> Add line
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="outline" onClick={revert}>
              Revert
            </Button>
            <SubmitButton
              variant="outline"
              disabled={!canPost}
              pendingLabel="Saving…"
              onClick={() => markSave('close')}
            >
              Save &amp; Close
            </SubmitButton>
            <SubmitButton disabled={!canPost} pendingLabel="Saving…" onClick={() => markSave('new')}>
              Save &amp; New
            </SubmitButton>
          </div>
        </div>
      </Card>

      {listOpen ? (
        <Card className="overflow-hidden p-0 print:hidden">
          <div className="flex flex-wrap items-center gap-3 border-b bg-[#f7f8f4] px-3 py-2">
            <p className="text-sm font-medium">List of journal entries</p>
            <select
              aria-label="Which entries"
              value={listFilter}
              onChange={(event) => setListFilter(event.target.value as 'all' | 'manual' | 'adjusting')}
              className="h-7 rounded-md border border-input bg-card px-2 text-xs"
            >
              <option value="all">All</option>
              <option value="manual">Manual</option>
              <option value="adjusting">Adjusting</option>
            </select>
          </div>
          <div className="max-h-56 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#dcecc8] text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                <tr>
                  <th className="px-3 py-1.5 text-left">Date</th>
                  <th className="px-3 py-1.5 text-left">Entry no.</th>
                  <th className="px-3 py-1.5 text-left">Adj</th>
                  <th className="px-3 py-1.5 text-left">Account</th>
                  <th className="px-3 py-1.5 text-left">Memo</th>
                  <th className="px-3 py-1.5 text-right">Debit</th>
                </tr>
              </thead>
              <tbody>
                {listed.map((line) => (
                  <tr key={line.lineId} className="border-t hover:bg-slate-50">
                    <td className="tabular whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                      {formatDate(line.date)}
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        className="tabular font-medium underline-offset-4 hover:underline"
                        onClick={() => router.push(`/journals/${line.journalId}`)}
                      >
                        {line.number}
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{line.adjusting ? 'Yes' : ''}</td>
                    <td className="px-3 py-1.5">{line.account}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{line.memo ?? ''}</td>
                    <td className="tabular px-3 py-1.5 text-right">{formatMoney(line.amount, currency)}</td>
                  </tr>
                ))}
                {listed.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-sm text-muted-foreground">
                      No journal entries in this list.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

    </form>
  )
}

function JournalFinder({ currency }: { currency: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState('')
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [rows, setRows] = useState<
    {
      id: string
      number: string
      date: string
      memo: string | null
      party: string | null
      total: string
    }[]
  >([])
  const [note, setNote] = useState<string | null>(null)

  async function search(next?: { number?: string; date?: string; amount?: string }) {
    const result = await findJournals({
      number: next?.number ?? number,
      date: next?.date ?? date,
      amount: next?.amount ?? amount,
    })
    if (result.ok) {
      setRows(result.data)
      setNote(null)
    } else {
      setRows([])
      setNote(result.error.message)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void search({ number: '', date: '', amount: '' })
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <SearchIcon />
          Find
        </Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Find a journal entry</DialogTitle>
          <DialogDescription>Search by the entry number, the date, or the amount.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-3">
          <Field name="findNumber" label="Entry no.">
            <Input
              id="findNumber"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="JE-00001"
              autoComplete="off"
            />
          </Field>
          <Field name="findDate" label="Date">
            <Input id="findDate" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field name="findAmount" label="Amount">
            <Input
              id="findAmount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="100"
              autoComplete="off"
            />
          </Field>
          <Button type="button" onClick={() => void search()}>
            <SearchIcon />
            Find
          </Button>
        </div>
        <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100"
                onClick={() => {
                  setOpen(false)
                  router.push(`/journals/${row.id}`)
                }}
              >
                <span>
                  <span className="font-medium">{row.number}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {[row.party, row.memo, formatDate(row.date)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="tabular">{formatMoney(row.total, currency)}</span>
              </button>
            </li>
          ))}
          {note ? <li className="px-2 py-3 text-sm text-destructive">{note}</li> : null}
          {!note && rows.length === 0 ? (
            <li className="px-2 py-3 text-sm text-muted-foreground">No journal entry matches.</li>
          ) : null}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

const requirementOf = (account: AccountPickerOption | undefined): PartyRequirement =>
  account?.requiresParty ?? null
