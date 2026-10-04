import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { accountOptions } from '@/lib/account-options'
import { today } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import * as accountService from '@/server/services/account.service'
import { subledgerBalances } from '@/server/services/contact.service'
import * as journalService from '@/server/services/journal.service'
import { JournalEntryForm } from './journal-entry-form'

export const metadata: Metadata = { title: 'New journal entry' }

export default async function NewJournalPage() {
  const ctx = await requireOrgContext('journal:post')

  const [chart, customers, vendors, entryNumber, register] = await Promise.all([
    // The whole chart. Every postable account, receivables, payables, stock and
    // system accounts included. The screen used to hide those three, on the
    // theory that a hand-written entry against a control account would break the
    // agreement with its subledger. It does not: the subledger *is* the control
    // account's lines, and the reports read them. What the ledger actually
    // requires is a name on the line (R7), which is what the form now asks for.
    accountService.selectableAccounts(ctx, { withBalances: true }),
    db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true, companyName: true },
      orderBy: { displayName: 'asc' },
    }),
    db.vendor.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true, companyName: true },
      orderBy: { displayName: 'asc' },
    }),
    peekDocumentNumber(db, ctx.orgId, 'JOURNAL'),
    journalService.registerLines(ctx),
  ])
  const [customerBalances, vendorBalances] = await Promise.all([
    subledgerBalances(db, ctx, 'customer', customers.map((customer) => customer.id)),
    subledgerBalances(db, ctx, 'vendor', vendors.map((vendor) => vendor.id)),
  ])

  return (
    <>

      <PageHeader
        title="Journal entry"
        description="Cash from a customer: debit the bank, credit Accounts Receivable, and name the customer. Paying a vendor you owe: debit Accounts Payable, name the vendor, and credit the bank."
      />
      <p className="mb-3 text-xs text-muted-foreground print:hidden">
        Type a few letters of an account or a name, then press Tab to take the highlighted match and move on.
      </p>

      <JournalEntryForm
        accounts={accountOptions(chart).map((option) =>
          option.subtype === 'BANK' && option.balance != null
            ? { ...option, hint: `Bank · ${formatMoney(option.balance, ctx.organization.baseCurrency)}` }
            : option,
        )}
        customers={customers.map((customer) => ({
          id: customer.id,
          label: customer.displayName,
          balance: (customerBalances.get(customer.id) ?? 0).toString(),
          hint: `Owes you ${formatMoney(customerBalances.get(customer.id) ?? 0, ctx.organization.baseCurrency)}`,
        }))}
        vendors={vendors.map((vendor) => ({
          id: vendor.id,
          label: vendor.displayName,
          balance: (vendorBalances.get(vendor.id) ?? 0).toString(),
          hint: `You owe ${formatMoney(vendorBalances.get(vendor.id) ?? 0, ctx.organization.baseCurrency)}`,
        }))}
        entryNumber={entryNumber}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        register={register}
      />
    </>
  )
}
