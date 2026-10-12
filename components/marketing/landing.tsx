import Link from 'next/link'
import {
  ArrowRight,
  Banknote,
  BookOpen,
  Boxes,
  ChartColumnIncreasing,
  Database,
  LayoutGrid,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Receipt,
  ShoppingCart,
  Store,
} from 'lucide-react'

import { AiDemoPlayer } from '@/components/marketing/ai-demo-player'
import { WebsiteShell } from '@/components/marketing/website-shell'
import { AI_DEMO_VIDEOS } from '@/lib/ai-demo-videos'
import {
  DEFAULT_MARKETING_CONTACT,
  mailtoUrl,
  telUrl,
  whatsappUrl,
  type MarketingContact,
} from '@/lib/marketing-site'
import {
  PRODUCT_BUILDER,
  PRODUCT_KIND,
  PRODUCT_MARK,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
} from '@/lib/product-brand'

/**
 * Public front of SOM ERP.
 *
 * Colours follow Appearance → Website look:
 * - Match system: same tokens as the signed-in desk
 * - Product website: navy / cyan marketing skin
 */

const MODULES = [
  {
    icon: BookOpen,
    name: 'Accounting',
    body: 'Double-entry journals, chart of accounts, open periods, and an immutable posted ledger.',
  },
  {
    icon: Receipt,
    name: 'Sales & receivables',
    body: 'Estimates, quotations, orders, invoices, receipts, delivery notes, and customer payments.',
  },
  {
    icon: ShoppingCart,
    name: 'Purchases & payables',
    body: 'Bills, purchase orders, vendor credits, expenses, goods receipt, and bill payments.',
  },
  {
    icon: Package,
    name: 'Inventory & stores',
    body: 'Stock on hand, multi-store transfers, adjustments, and product catalogues tied to the books.',
  },
  {
    icon: Store,
    name: 'Point of sale',
    body: 'Registers, sessions, quotations, thermal receipts, and sales that post straight into the ledger.',
  },
  {
    icon: Banknote,
    name: 'Banking',
    body: 'Bank accounts, transfers, deposits, statement import, and reconciliation against posted lines.',
  },
  {
    icon: ChartColumnIncreasing,
    name: 'Reports',
    body: 'P&L, balance sheet, cash flow, trial balance, aging, and drill-down into every account.',
  },
  {
    icon: Database,
    name: 'Companies & backup',
    body: 'Switch between company databases, control features per organisation, and restore full backups.',
  },
] as const

const WORKFLOW = [
  {
    step: '01',
    title: 'Open a company',
    body: 'Create or switch into a company database. Chart of accounts and periods start clean.',
  },
  {
    step: '02',
    title: 'Record the day',
    body: 'Invoices, bills, stock moves, and POS sales become journals the ledger can trust.',
  },
  {
    step: '03',
    title: 'Close with clarity',
    body: 'Reconcile the bank, run statements, and close periods without rewriting history.',
  },
] as const

export function Landing({
  signedIn,
  contact = DEFAULT_MARKETING_CONTACT,
}: {
  signedIn: boolean
  contact?: MarketingContact
}) {
  const enterHref = signedIn ? '/dashboard' : '/register'
  const enterLabel = signedIn ? 'Open your books' : 'Request a company'

  return (
    <WebsiteShell className="erp-landing min-h-screen bg-background text-[15px] leading-relaxed text-foreground">
      <style>{landingCss}</style>
      <SiteHeader signedIn={signedIn} enterHref={enterHref} enterLabel={enterLabel} />
      <main>
        <Hero enterHref={enterHref} enterLabel={enterLabel} />
        <Modules />
        <Workflow />
        <Tutorials />
        <Contact contact={contact} />
        <Cta enterHref={enterHref} enterLabel={enterLabel} />
      </main>
      <SiteFooter contact={contact} />
    </WebsiteShell>
  )
}

function Wordmark() {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-md bg-primary text-[13px] font-bold tracking-wide text-primary-foreground shadow-[0_8px_24px_-10px_var(--glow)]">
        {PRODUCT_MARK}
      </span>
      <span className="leading-tight">
        <span className="block text-[17px] font-semibold tracking-tight text-foreground">
          {PRODUCT_NAME}
        </span>
        <span className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-success sm:block">
          {PRODUCT_KIND}
        </span>
      </span>
    </Link>
  )
}

function SiteHeader({
  signedIn,
  enterHref,
  enterLabel,
}: {
  signedIn: boolean
  enterHref: string
  enterLabel: string
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Wordmark />

        <nav className="hidden items-center gap-7 text-[14px] font-medium text-muted-foreground md:flex">
          <a className="transition-colors hover:text-foreground" href="#modules">
            Modules
          </a>
          <a className="transition-colors hover:text-foreground" href="#tutorials">
            How to use
          </a>
          <a className="transition-colors hover:text-foreground" href="#contact">
            Contact
          </a>
          <Link className="transition-colors hover:text-foreground" href="/login">
            Login
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {!signedIn ? (
            <Link
              className="hidden h-9 items-center rounded-md px-3 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
              href="/sign-in"
            >
              Sign in
            </Link>
          ) : null}
          <Link
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[14px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
            href={enterHref}
          >
            {enterLabel}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  )
}

function Hero({ enterHref, enterLabel }: { enterHref: string; enterLabel: string }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_80%_at_78%_-5%,color-mix(in_oklab,var(--success)_22%,transparent),transparent_55%),radial-gradient(70%_60%_at_8%_100%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_55%)]"
      />
      <div aria-hidden className="erp-grid pointer-events-none absolute inset-0 opacity-[0.35]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-24">
        <div className="erp-fade">
          <h1 className="text-[clamp(2.4rem,5.5vw,3.75rem)] font-bold leading-[0.98] tracking-[-0.03em] text-foreground">
            {PRODUCT_NAME}
          </h1>
          <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.22em] text-success">
            {PRODUCT_KIND}
          </p>

          <p className="mt-7 max-w-xl text-[1.55rem] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground sm:text-[1.85rem]">
            One system for books, stock, sales, and the counter.
          </p>

          <p className="mt-5 max-w-lg text-[17px] leading-[1.65] text-muted-foreground">
            {PRODUCT_TAGLINE} — every invoice, bill, and POS sale lands in a ledger you can audit,
            not a spreadsheet you hope is right.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-[15px] font-semibold text-primary-foreground shadow-[0_12px_36px_-14px_var(--glow)] transition-transform hover:-translate-y-0.5 hover:opacity-90"
              href={enterHref}
            >
              {enterLabel}
              <ArrowRight className="size-4" />
            </Link>
            <a
              className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-card px-6 text-[15px] font-medium text-foreground transition-colors hover:bg-secondary"
              href="#modules"
            >
              See what it does
            </a>
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  )
}

function HeroVisual() {
  return (
    <div className="erp-float relative mx-auto w-full max-w-md lg:max-w-none">
      <div
        aria-hidden
        className="absolute -inset-8 rounded-[40px] bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] blur-3xl"
      />

      <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-destructive/70" />
          <span className="size-2.5 rounded-full bg-warning/80" />
          <span className="size-2.5 rounded-full bg-success/70" />
          <span className="ml-3 text-[12px] font-medium tracking-wide text-muted-foreground">
            {PRODUCT_NAME} · live books
          </span>
        </div>

        <div className="grid grid-cols-[0.32fr_0.68fr]">
          <aside className="space-y-1 border-r border-border bg-background p-2.5">
            {[
              { icon: LayoutGrid, label: 'Apps', on: true },
              { icon: Receipt, label: 'Sales' },
              { icon: ShoppingCart, label: 'Purchases' },
              { icon: Boxes, label: 'Inventory' },
              { icon: BookOpen, label: 'Accounting' },
              { icon: ChartColumnIncreasing, label: 'Reports' },
            ].map(({ icon: Icon, label, on }) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] ${
                  on
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                <Icon className="size-3.5 shrink-0" />
                <span>{label}</span>
              </div>
            ))}
          </aside>

          <div className="space-y-3 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  This month
                </p>
                <p className="mt-1 text-[1.45rem] font-bold tracking-tight text-foreground">
                  Profit &amp; Loss
                </p>
              </div>
              <span className="rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-accent-foreground">
                Posted
              </span>
            </div>

            <div className="space-y-2">
              {[
                ['Income', '84%', 'var(--primary)'],
                ['Cost of sales', '52%', 'var(--success)'],
                ['Expenses', '31%', 'var(--muted-foreground)'],
              ].map(([label, width, tone]) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-[12px] text-muted-foreground">
                    <span>{label}</span>
                    <span className="tabular-nums text-foreground/80">{width}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{ width, background: `linear-gradient(90deg, ${tone}, transparent)` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {[
                ['Open invoices', '24'],
                ['Stock alerts', '6'],
                ['Bank to reconcile', '2'],
                ['Journals today', '18'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-border bg-background px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-[1.1rem] font-bold text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string
  title: string
  body: string
}) {
  return (
    <div className="max-w-2xl">
      <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-success">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-[2rem] font-bold leading-tight tracking-[-0.02em] text-foreground sm:text-[2.35rem]">
        {title}
      </h2>
      <p className="mt-4 text-[16.5px] leading-[1.65] text-muted-foreground">{body}</p>
    </div>
  )
}

function Modules() {
  return (
    <section id="modules" className="scroll-mt-20 border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="What the system does"
          title="Every desk your company needs — one ledger underneath."
          body="SOM ERP is not a pile of separate tools. Sales, purchases, stock, POS, banking, and reports all post into the same double-entry books."
        />

        <ul className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {MODULES.map(({ icon: Icon, name, body }, index) => (
            <li
              key={name}
              className="erp-module group grid grid-cols-[auto_1fr] gap-4 border-t border-border pt-6"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <span className="mt-0.5 grid size-10 place-items-center rounded-md bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <div>
                <h3 className="text-[1.15rem] font-semibold tracking-tight text-foreground">{name}</h3>
                <p className="mt-2 text-[14.5px] leading-[1.65] text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Workflow() {
  return (
    <section id="how" className="scroll-mt-20 border-t border-border bg-secondary/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="How work moves"
          title="From the counter to closed books."
          body="The path is short on purpose: open the company, record what happened, and trust the statements that fall out of the ledger."
        />

        <ol className="mt-14 grid gap-10 lg:grid-cols-3">
          {WORKFLOW.map(({ step, title, body }) => (
            <li key={step} className="relative">
              <span className="text-[3rem] font-extrabold leading-none tracking-tight text-primary/20">
                {step}
              </span>
              <h3 className="mt-3 text-[1.25rem] font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-[14.5px] leading-[1.65] text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Tutorials() {
  return (
    <section id="tutorials" className="scroll-mt-20 border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Sida loo isticmaalo · AI videos"
          title="Watch the AI demos. Then do the work."
          body="Five short AI videos about SOM ERP — sign in, sell, buy, run the till, and close the month. Press Play on each one."
        />
        <AiDemoPlayer videos={AI_DEMO_VIDEOS} />
      </div>
    </section>
  )
}

function Contact({ contact }: { contact: MarketingContact }) {
  const officeLine = `${contact.address}, ${contact.city}, ${contact.region}`
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(officeLine)}`
  const waHref = whatsappUrl(
    contact.whatsappE164,
    `Assalaamu calaykum ${contact.contactName}. Waxaan ka imid website-ka ${PRODUCT_NAME} — waxaan jeclaan lahaa inaan kala hadlo nidaamka xisaabaadka, tababarka, ama furitaanka database shirkadeed.`,
  )

  const rows = [
    {
      icon: Phone,
      term: 'Phone',
      detail: contact.phone,
      href: telUrl(contact.phone),
      hint: 'Direct call',
    },
    {
      icon: MessageCircle,
      term: 'WhatsApp',
      detail: contact.phone,
      href: waHref,
      hint: 'Chat now',
    },
    {
      icon: Mail,
      term: 'Email',
      detail: contact.email,
      href: mailtoUrl(contact.email, `${PRODUCT_NAME} support`),
      hint: 'Personal',
    },
    ...(contact.secondaryEmail
      ? [
          {
            icon: Mail,
            term: 'Company email',
            detail: contact.secondaryEmail,
            href: mailtoUrl(contact.secondaryEmail, `${PRODUCT_NAME} inquiry`),
            hint: 'Office',
          },
        ]
      : []),
    {
      icon: MapPin,
      term: 'Office',
      detail: officeLine,
      href: mapsHref,
      hint: 'Open map',
    },
  ]

  return (
    <section id="contact" className="scroll-mt-20 border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_90%_at_0%_0%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_55%),radial-gradient(60%_80%_at_100%_100%,color-mix(in_oklab,var(--success)_12%,transparent),transparent_50%)]"
          />
          <div
            aria-hidden
            className="erp-grid pointer-events-none absolute inset-0 opacity-20"
          />

          <div className="relative grid gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-14">
            <SectionHeading
              eyebrow="Contact · La soo xiriir"
              title={contact.companyName}
              body={`${contact.contactName} — call, WhatsApp, or email when you need help with SOM ERP, training, or a new company database.`}
            />

            <div className="flex flex-wrap gap-3">
              <a
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-[15px] font-semibold text-primary-foreground shadow-[0_14px_40px_-16px_var(--glow)] transition-transform hover:-translate-y-0.5 hover:opacity-95"
                href={waHref}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="size-4" />
                WhatsApp
              </a>
              <a
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-background/70 px-6 text-[15px] font-medium text-foreground backdrop-blur transition-colors hover:border-primary/40 hover:bg-accent/50"
                href={telUrl(contact.phone)}
              >
                <Phone className="size-4" />
                Call
              </a>
              <a
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-background/70 px-6 text-[15px] font-medium text-foreground backdrop-blur transition-colors hover:border-primary/40 hover:bg-accent/50"
                href={mailtoUrl(contact.email, `${PRODUCT_NAME} support`)}
              >
                <Mail className="size-4" />
                Email
              </a>
            </div>
          </div>

          <dl className="relative grid gap-3 border-t border-border bg-background/35 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            {rows.map(({ icon: Icon, term, detail, href, hint }, index) => {
              const body = (
                <>
                  <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground ring-1 ring-primary/15">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {term}
                      </dt>
                      <span className="text-[11px] text-success/90">{hint}</span>
                    </span>
                    <dd className="mt-1.5 break-words text-[15px] font-semibold leading-snug tracking-tight text-foreground">
                      {detail}
                    </dd>
                  </span>
                </>
              )
              const className =
                'erp-contact-card group flex items-start gap-3.5 rounded-xl border border-border/80 bg-card/90 px-4 py-4 shadow-[0_1px_0_color-mix(in_oklab,var(--foreground)_4%,transparent)] transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-primary/45 hover:bg-accent/40'
              return href ? (
                <a
                  key={`${term}-${detail}`}
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noreferrer' : undefined}
                  className={className}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {body}
                </a>
              ) : (
                <div
                  key={`${term}-${detail}`}
                  className={className}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {body}
                </div>
              )
            })}
          </dl>
        </div>
      </div>
    </section>
  )
}

function Cta({ enterHref, enterLabel }: { enterHref: string; enterLabel: string }) {
  return (
    <section className="border-t border-border py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="relative overflow-hidden rounded-lg border border-border bg-card px-7 py-14 sm:px-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_100%_at_100%_0%,color-mix(in_oklab,var(--success)_18%,transparent),transparent_55%)]"
          />
          <div className="relative max-w-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-success">
              Get started
            </p>
            <h2 className="mt-3 text-[2rem] font-bold tracking-[-0.02em] text-foreground sm:text-[2.3rem]">
              Request a company on {PRODUCT_NAME}.
            </h2>
            <p className="mt-4 text-[16px] leading-[1.65] text-muted-foreground">
              Outside businesses send a request. They cannot sign in until you approve them under
              Databases. Each approved company gets its own apps, settings, users, and ledger.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-[15px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
                href={enterHref}
              >
                {enterLabel}
                <ArrowRight className="size-4" />
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-md border border-border px-6 text-[15px] font-medium text-foreground transition-colors hover:bg-secondary"
                href="/sign-in"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-6 text-[13px] text-muted-foreground">
              Create: <span className="font-mono text-success">/register</span>
              <span className="mx-2 text-border">·</span>
              Sign in: <span className="font-mono text-success">/sign-in</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function SiteFooter({ contact }: { contact: MarketingContact }) {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 sm:px-8 md:flex-row md:items-center">
        <Wordmark />
        <div className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[14px] text-muted-foreground">
          <a className="transition-colors hover:text-foreground" href="#tutorials">
            How to use
          </a>
          <a className="transition-colors hover:text-foreground" href="#contact">
            Contact
          </a>
          <Link className="transition-colors hover:text-foreground" href="/login">
            Login
          </Link>
          <a className="transition-colors hover:text-foreground" href={telUrl(contact.phone)}>
            {contact.phone}
          </a>
        </div>
        <p className="text-[13px] text-muted-foreground">
          &copy; {new Date().getFullYear()} {contact.companyName}
          <span className="mx-1.5 text-border">·</span>
          {PRODUCT_NAME} · {PRODUCT_BUILDER}
        </p>
      </div>
    </footer>
  )
}

const landingCss = `
  .erp-landing {
    font-family: var(--font-odoo), var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  }
  .erp-grid {
    background-image:
      linear-gradient(to right, color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px),
      linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px);
    background-size: 64px 64px;
    mask-image: radial-gradient(70% 60% at 50% 20%, black, transparent);
  }
  @keyframes erp-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes erp-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  .erp-fade {
    animation: erp-fade-up 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .erp-float {
    animation: erp-float 7s ease-in-out infinite;
  }
  .erp-contact-card {
    animation: erp-fade-up 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @media (prefers-reduced-motion: reduce) {
    .erp-fade, .erp-float, .erp-contact-card { animation: none; }
  }
`
