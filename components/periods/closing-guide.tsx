import { Card } from '@/components/ui/card'

/**
 * Plain-language walkthrough of month close vs year close — what locks, what
 * zeros, and what the bookkeeper still has to do afterwards.
 */
export function ClosingGuide() {
  return (
    <Card className="mb-6 space-y-4 p-4">
      <div>
        <p className="text-sm font-medium">How closing works — detail</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Two different jobs share the word &quot;close&quot;. Mixing them up is the usual
          source of confusion.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-2 rounded-md border bg-muted/30 p-3">
          <h3 className="text-sm font-semibold">1. Month close (bil-xir)</h3>
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">What it does:</span> locks that month
              so no new journals, invoices, bills, or payments can post into those dates.
            </li>
            <li>
              <span className="font-medium text-foreground">What it does not do:</span> it does{' '}
              <span className="font-medium text-foreground">not</span> clear Profit &amp; Loss.
              Income and expense balances keep accumulating for the whole fiscal year.
            </li>
            <li>
              <span className="font-medium text-foreground">Order:</span> months close in date
              order (opening balances first, then January, February, …). You cannot skip ahead.
            </li>
            <li>
              <span className="font-medium text-foreground">Checklist:</span> warnings (bank not
              reconciled, drafts, undeposited funds) still allow a soft close. Blocked items
              (books out of balance) must be fixed first.
            </li>
          </ul>
        </section>

        <section className="space-y-2 rounded-md border bg-muted/30 p-3">
          <h3 className="text-sm font-semibold">2. Year close (sanad-xir)</h3>
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">What it does:</span> posts one closing
              journal that zeros every revenue, COGS, and expense account, and puts the net
              income (or loss) into <span className="font-medium text-foreground">Retained Earnings</span>.
            </li>
            <li>
              <span className="font-medium text-foreground">Then:</span> every period in that year
              becomes locked. Nothing can post into that year afterwards.
            </li>
            <li>
              <span className="font-medium text-foreground">Months first?</span> Not required. The
              closing entry is dated on the year end, so the engine posts it while months are
              still open, then locks them in the same step.
            </li>
            <li>
              <span className="font-medium text-foreground">Undo:</span> reopen reverses the
              closing journal (it is never deleted). Only Owner / Admin can unlock.
            </li>
          </ul>
        </section>
      </div>

      <section className="space-y-1.5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Accounts you will see in the board below</p>
        <p>
          <span className="font-medium text-foreground">Revenue / COGS / Expense</span> — each
          line is taken to zero (debit a credit balance, credit a debit balance).{' '}
          <span className="font-medium text-foreground">Retained Earnings</span> receives the
          difference: profit as a credit, loss as a debit. After year close, distribute that
          equity to owners from the card further down if you need owner capital accounts updated.
        </p>
      </section>
    </Card>
  )
}
