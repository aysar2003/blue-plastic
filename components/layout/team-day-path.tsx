import Link from 'next/link'

/**
 * Human-team “day / month / year” path for a trading company like Al Furaat:
 * sell → collect → buy → stock → close. One job per step so new staff know where to start.
 */
const STEPS: { href: string; who: string; label: string; hint: string }[] = [
  {
    href: '/sales/invoices',
    who: 'Sales',
    label: 'Sell',
    hint: 'Invoices & orders',
  },
  {
    href: '/payments',
    who: 'Cashier',
    label: 'Collect',
    hint: 'Receive payments',
  },
  {
    href: '/purchases/bills',
    who: 'Purchasing',
    label: 'Buy',
    hint: 'Bills & POs',
  },
  {
    href: '/inventory/stock',
    who: 'Store',
    label: 'Stock',
    hint: 'On hand & reorder',
  },
  {
    href: '/banking/accounts',
    who: 'Accounts',
    label: 'Bank',
    hint: 'Deposit & reconcile',
  },
  {
    href: '/periods',
    who: 'Accountant',
    label: 'Close',
    hint: 'Month & year end',
  },
]

export function TeamDayPath() {
  return (
    <section
      aria-label="Team work path"
      className="mx-auto w-full px-[clamp(0.75rem,2vw,2.5rem)] pt-6"
    >
      <div className="rounded-xl border bg-card/80 px-4 py-3 shadow-sm">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              How the team works
            </p>
            <p className="text-sm text-foreground">
              Follow the day — then the month — then the year. Each step is one person’s job.
            </p>
          </div>
          <Link
            href="/help/guide"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Full guide
          </Link>
        </div>
        <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STEPS.map((step, index) => (
            <li key={step.href}>
              <Link
                href={step.href}
                className="group flex h-full flex-col rounded-lg border border-transparent bg-muted/40 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-muted"
              >
                <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
                  {index + 1}. {step.who}
                </span>
                <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                  {step.label}
                </span>
                <span className="text-xs text-muted-foreground">{step.hint}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** Prefer a human first name; skip placeholder login-test labels. Empty = no name. */
export function friendlyFirstName(fullName: string | null | undefined): string {
  const skip = /^(login|test|company|staff|portal|user|admin)$/i
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  const pick = parts.find((part) => !skip.test(part))
  return pick ?? ''
}
