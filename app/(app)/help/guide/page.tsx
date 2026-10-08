import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Help' }

/**
 * The manual, inside the application.
 *
 * There is no separate documentation site, which is the right decision for a
 * system with one organisation using it: a manual nobody opens is worse than no
 * manual, and the moment somebody needs an answer they are already here.
 *
 * What belongs on these pages is what the screens cannot say for themselves —
 * why the ledger behaves as it does, and what the sequence of work is. What does
 * not belong is a description of which button is where.
 */

const FLOWS: { title: string; steps: { text: string; href?: string }[] }[] = [
  {
    title: 'Setting up',
    steps: [
      { text: 'Install the chart of accounts, then rename or add what this business actually uses.', href: '/accounts' },
      { text: 'Set the base currency and the month your fiscal year starts.', href: '/settings/organization' },
      { text: 'Check which account each system role posts to — receivables, payables, uncategorised income.', href: '/settings/accounts' },
      { text: 'Add tax agencies, rates and codes before entering anything taxable.', href: '/settings/tax' },
      { text: 'Enter customers and vendors, with their opening balances if the books are not new.', href: '/customers' },
      { text: 'Enter products and services, and the accounts each one is sold and bought into.', href: '/items' },
    ],
  },
  {
    title: 'A sale, end to end',
    steps: [
      { text: 'Raise an invoice. It debits Accounts Receivable and credits income and tax.', href: '/sales/invoices/new' },
      { text: 'Receive the payment against it. Cash goes up, the receivable goes down.', href: '/payments/new' },
      { text: 'If the money went to Undeposited Funds, record the deposit when it reaches the bank.', href: '/banking/deposits/new' },
      { text: 'A return is a credit memo, applied to the invoice — never an edit to the invoice.', href: '/sales/credit-memos/new' },
    ],
  },
  {
    title: 'A purchase, end to end',
    steps: [
      { text: 'A bill is something owed. An expense is something already paid.', href: '/purchases/bills/new' },
      { text: 'Enter costs as categories (rent, fuel) and goods as items. A bill can carry both; only item lines move stock.', href: '/purchases/bills/new' },
      { text: 'Pay bills from the bill payments screen, one payment across as many bills as you like.', href: '/bill-payments/new' },
      { text: 'A vendor credit reduces what you owe, and is applied the same way a payment is.', href: '/purchases/vendor-credits/new' },
    ],
  },
  {
    title: 'Stock',
    steps: [
      { text: 'Only an item whose type is "Inventory product" tracks stock. The type is fixed once the item exists.', href: '/items' },
      { text: 'Create the product with what is on the shelf today and what it cost — the opening quantity posts into the inventory account against Opening Balance Equity.', href: '/items' },
      { text: 'After that, stock arrives by entering the bill or expense you bought it on.', href: '/purchases/bills/new' },
      { text: 'A count that disagrees with the books is recorded as an adjustment, and the difference goes to Inventory Shrinkage.', href: '/inventory/adjustments/new' },
      { text: 'Selling a tracked item moves stock and posts its cost in the same entry as the sale. A non-inventory item does neither.', href: '/inventory/stock' },
    ],
  },
  {
    title: 'Every month',
    steps: [
      { text: 'Import or enter the bank statement, then reconcile each account to it.', href: '/banking/accounts' },
      { text: 'Work through the close checklist and fix anything it flags.', href: '/periods' },
      { text: 'Read the profit and loss, and check the balance sheet says it balances.', href: '/reports/profit-loss' },
      { text: 'Close the period. Nothing can then be posted into it without reopening it.', href: '/periods' },
    ],
  },
  {
    title: 'Every year',
    steps: [
      { text: 'Post the adjustments — depreciation, accruals, prepayments — marked as adjusting.', href: '/journals/new' },
      { text: 'Check the adjusting entries report shows what you expect and nothing else.', href: '/reports/adjusting-entries' },
      { text: 'Close the fiscal year. This sweeps the profit into Retained Earnings and locks every month in it.', href: '/periods' },
    ],
  },
]

const RULES: { rule: string; why: string }[] = [
  {
    rule: 'A posted entry is never edited or deleted.',
    why: 'It is reversed, and both entries stay. An audit trail that can lose a transaction is not an audit trail, and the database refuses the edit even if the application asks for it.',
  },
  {
    rule: 'A document the ledger has never seen can simply be deleted.',
    why: 'A draft or an estimate has told the ledger nothing and nobody outside the business holds its number, so getting rid of a mistake does not need a reversal. Anything posted is voided instead — the entry comes out, any stock goes back, and the document stays readable with VOID across it. Every screen offers whichever of the two applies, and says why when neither does.',
  },
  {
    rule: 'Every entry balances, to the cent.',
    why: 'Debits equal credits or the transaction does not commit. This is checked by the database at commit time, not by the form.',
  },
  {
    rule: 'Nothing posts into a closed period.',
    why: 'Closing a month is what makes last month’s figures stay the same. Reopen it deliberately if you need to change something.',
  },
  {
    rule: 'A receivable always names a customer; a payable always names a vendor.',
    why: 'Otherwise the ageing report and the control account drift apart, and finding out which one is right takes a day.',
  },
  {
    rule: 'Money is stored exactly, never as a floating-point number.',
    why: 'Four decimal places, rounded half away from zero when it reaches a currency. Cents do not go missing between the screen and the ledger.',
  },
  {
    rule: 'Stock is valued at weighted average cost.',
    why: 'Selling an item does not change the average; only buying does. The stock ledger is checked against the Inventory account on every close.',
  },
]

export default async function HelpPage() {
  await requireOrgContext()

  return (
    <>
      <PageHeader
        title="Help"
        description="How this system expects to be used, and why it behaves the way it does."
      />

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold">The order of work</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {FLOWS.map((flow) => (
              <Card key={flow.title}>
                <CardHeader>
                  <CardTitle className="text-base">{flow.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2.5 text-sm">
                    {flow.steps.map((step, index) => (
                      <li key={step.text} className="flex gap-2.5">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[0.6875rem] font-medium tabular">
                          {index + 1}
                        </span>
                        <span className="min-w-0 text-muted-foreground">
                          {step.text}
                          {step.href ? (
                            <>
                              {' '}
                              <Link href={step.href} className="text-foreground underline underline-offset-4">
                                Open
                              </Link>
                            </>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Filling a form with the keyboard</h2>
          <Card>
            <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
              <p>
                Open an invoice or a bill and the customer or vendor name is focused. Tab moves through
                Date, number, due date, PO, then each line — Item, Description, Qty, Rate, Amount, Store.
                In a name picker, type a few letters and press Tab or Enter to take the highlighted match
                and continue; you do not need the mouse for the grid.
              </p>
              <p>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">Ctrl S</kbd> saves
                and closes.{' '}
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">Ctrl Shift S</kbd>{' '}
                saves and opens another blank one.{' '}
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">Ctrl L</kbd> adds a
                line. The full list is on{' '}
                <Link href="/help/shortcuts" className="text-foreground underline underline-offset-4">
                  Keyboard shortcuts
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Rules that will not bend</h2>
          <Card>
            <CardContent className="divide-y p-0">
              {RULES.map((entry) => (
                <div key={entry.rule} className="p-4">
                  <p className="text-sm font-medium">{entry.rule}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{entry.why}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">If something looks wrong</h2>
          <Card>
            <CardHeader>
              <CardDescription>
                Three reports check themselves and say so on screen. If any of them reports a difference,
                stop and read it before trusting any other figure — the difference is real, not a display
                problem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <Link href="/reports/trial-balance" className="font-medium underline underline-offset-4">
                  Trial balance
                </Link>{' '}
                — proves total debits equal total credits.
              </p>
              <p>
                <Link href="/reports/balance-sheet" className="font-medium underline underline-offset-4">
                  Balance sheet
                </Link>{' '}
                — proves assets equal liabilities plus equity.
              </p>
              <p>
                <Link href="/reports/cash-flow" className="font-medium underline underline-offset-4">
                  Cash flow
                </Link>{' '}
                — proves the statement explains the actual movement in the bank accounts.
              </p>
              <p className="pt-1 text-muted-foreground">
                The close checklist on the{' '}
                <Link href="/periods" className="underline underline-offset-4">
                  periods screen
                </Link>{' '}
                runs these and six more before you close a month.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  )
}
