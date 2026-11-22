import Link from 'next/link'
import {
  ArrowRight,
  Banknote,
  BookOpen,
  Boxes,
  BriefcaseBusiness,
  ChartColumnIncreasing,
  ClipboardCheck,
  Database,
  Factory,
  LayoutGrid,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Receipt,
  ShoppingCart,
  Store,
  Users,
  Warehouse,
} from 'lucide-react'

import { AiDemoPlayer } from '@/components/marketing/ai-demo-player'
import { PricingLeadForm } from '@/components/marketing/pricing-lead-form'
import { ProductWordmark } from '@/components/marketing/product-wordmark'
import { WebsiteShell } from '@/components/marketing/website-shell'
import { AI_DEMO_VIDEOS } from '@/lib/ai-demo-videos'
import { STORE_PATH } from '@/lib/al-furaat-site'
import {
  DEFAULT_MARKETING_CONTACT,
  mailtoUrl,
  telUrl,
  whatsappUrl,
  type MarketingContact,
} from '@/lib/marketing-site'
import { LOGIN_COMPANY, LOGIN_DOORS, LOGIN_HUB } from '@/lib/login-paths'
import {
  PRODUCT_BUILDER,
  PRODUCT_KIND,
  PRODUCT_NAME,
} from '@/lib/product-brand'

/**
 * Advanced public product site — navy field + SOM cyan.
 * Not a white SaaS template: full-bleed hero, ledger rails, deep capability map.
 */

const WORK_LANES = [
  {
    title: 'Sell and collect',
    body: 'Estimates, quotations, orders, invoices, delivery notes, receipts, customer payments, and subscriptions with dunning — every sale posts to the ledger.',
  },
  {
    title: 'Buy and pay',
    body: 'Purchase orders, bills, expenses, vendor credits, goods receipt, landed cost, and bill payments so payables stay tied to stock and cash.',
  },
  {
    title: 'Stock and stores',
    body: 'Products, multi-store quantity, transfers, adjustments, barcodes, bins, ASN/waves, replenish min/max, and expiry — inventory that feeds COGS.',
  },
  {
    title: 'Counter and till',
    body: 'POS registers, sessions, quotations, thermal receipts, till count vs expected, credit controls, and kitchen/hospitality flows when you need them.',
  },
  {
    title: 'Bank and close',
    body: 'Bank accounts, transfers, deposits, statement CSV import, reconciliation, FX payments, loans, insurance schedules, and period close without rewriting history.',
  },
  {
    title: 'Jobs and people',
    body: 'Projects, timesheets, WIP, contracts/SOV, service jobs, planning, employees, leave, attendance, payroll packs, sign, discuss, and appointments.',
  },
] as const

const MODULES = [
  {
    icon: BookOpen,
    name: 'Accounting & journals',
    body: 'Chart of accounts, double-entry journals, open periods, budgets, equity, and an immutable posted ledger.',
  },
  {
    icon: Receipt,
    name: 'Sales & receivables',
    body: 'Estimates through invoices, receipts, delivery, customer payments, batch tools, and aging.',
  },
  {
    icon: ShoppingCart,
    name: 'Purchases & payables',
    body: 'POs, bills, expenses, vendor credits, goods receipt, landed cost, and vendor payments.',
  },
  {
    icon: Package,
    name: 'Inventory & warehouses',
    body: 'Stock on hand, stores, transfers, adjustments, barcodes, bins, ASN, replenish, and MRP capacity.',
  },
  {
    icon: Store,
    name: 'Point of sale',
    body: 'Registers, sessions, till P&L, reprint, credit block, and sales that post straight into the books.',
  },
  {
    icon: Banknote,
    name: 'Banking & treasury',
    body: 'Accounts, transfers, deposits, statement import, reconciliation, loans, and insurance registers.',
  },
  {
    icon: BriefcaseBusiness,
    name: 'Projects & service',
    body: 'Jobs, tasks, Gantt, timesheets, WIP, retainers, contracts, SOV progress, and service van stock.',
  },
  {
    icon: Users,
    name: 'HR & collaboration',
    body: 'Employees, recruitment, leave, attendance, payroll CSV, sign, discuss, planning, calendar, and surveys.',
  },
  {
    icon: ChartColumnIncreasing,
    name: 'Reports & control',
    body: 'P&L, balance sheet, cash flow, trial balance, VAT packs, approvals, analytics, and drill-down.',
  },
  {
    icon: Database,
    name: 'Companies & backup',
    body: 'Multi-company databases, feature switches per org, billing/rent, backup and restore.',
  },
  {
    icon: ClipboardCheck,
    name: 'Quality & compliance',
    body: 'CAPA, localization packs (tax/VAT/payroll headers), e-invoice JSON, and portal payment proof.',
  },
  {
    icon: Factory,
    name: 'Vertical desks',
    body: 'Optional NGO, education, hospital, agriculture, hospitality, marketplace, and co-op flows when you turn them on.',
  },
] as const

const WORKFLOW = [
  {
    step: '01',
    title: 'Open a company',
    body: 'Create or switch a company database. Chart of accounts, periods, and apps start ready for your trade.',
  },
  {
    step: '02',
    title: 'Run the day',
    body: 'Sell, buy, move stock, take POS, pay the bank — every move becomes a journal the ledger can audit.',
  },
  {
    step: '03',
    title: 'Close with proof',
    body: 'Reconcile, run statements, age receivables, close periods — history stays posted, not rewritten.',
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
  const enterLabel = signedIn ? 'Open your books' : 'Start free trial'

  return (
    <WebsiteShell className="erp-landing min-h-screen bg-background text-[15px] leading-relaxed text-foreground">
      <style>{landingCss}</style>
      <SiteHeader signedIn={signedIn} enterHref={enterHref} enterLabel={enterLabel} />
      <main>
        <Hero enterHref={enterHref} enterLabel={enterLabel} />
        <WorkPower />
        <Modules />
        <Workflow />
        <Pricing signedIn={signedIn} />
        <Tutorials />
        <Contact contact={contact} />
        <SignInDoors signedIn={signedIn} />
        <Cta enterHref={enterHref} enterLabel={enterLabel} />
      </main>
      <SiteFooter contact={contact} />
    </WebsiteShell>
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
    <header className="sticky top-0 z-50 border-b border-border/80 bg-[#05080f]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <ProductWordmark size="sm" />
        <nav className="hidden items-center gap-7 text-[13px] font-medium text-muted-foreground md:flex">
          <a className="transition-colors hover:text-primary" href="#power">
            Capabilities
          </a>
          <a className="transition-colors hover:text-primary" href="#modules">
            Modules
          </a>
          <a className="transition-colors hover:text-primary" href="#pricing">
            Pricing
          </a>
          <a className="transition-colors hover:text-primary" href="#tutorials">
            How to use
          </a>
          <a className="transition-colors hover:text-primary" href="#contact">
            Contact
          </a>
          {!signedIn ? (
            <Link className="transition-colors hover:text-primary" href={LOGIN_HUB}>
              Sign in
            </Link>
          ) : null}
        </nav>
        <div className="flex items-center gap-2">
          {!signedIn ? (
            <Link
              className="hidden h-9 items-center px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              href={LOGIN_COMPANY}
            >
              Company login
            </Link>
          ) : null}
          <Link
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
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
    <section className="relative min-h-[min(92svh,920px)] overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_-10%,rgba(34,211,238,0.28),transparent_55%),radial-gradient(ellipse_50%_45%_at_0%_90%,rgba(14,116,144,0.22),transparent_50%),linear-gradient(180deg,#05080f_0%,#070b14_55%,#05080f_100%)]"
      />
      <div aria-hidden className="erp-scan pointer-events-none absolute inset-0 opacity-50" />
      <div aria-hidden className="erp-beam pointer-events-none absolute -right-24 top-10 h-[70%] w-[55%] rotate-[-8deg]" />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:pb-24 lg:pt-24">
        <div className="erp-fade relative z-10 max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-primary">
            {PRODUCT_KIND}
          </p>
          <h1 className="erp-display mt-5 text-[clamp(3rem,8vw,5rem)] font-semibold leading-[0.9] tracking-[-0.045em] text-foreground">
            {PRODUCT_NAME}
          </h1>
          <p className="mt-7 max-w-md text-[1.25rem] font-medium leading-snug tracking-[-0.02em] text-slate-200 sm:text-[1.4rem]">
            One advanced ledger for books, stock, sales, and the counter.
          </p>
          <p className="mt-4 max-w-md text-[15px] leading-[1.7] text-muted-foreground">
            Traders and service teams post every invoice, bill, and POS sale into books you can
            audit — not a spreadsheet you hope is right.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-7 text-[15px] font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 hover:opacity-95"
              href={enterHref}
            >
              {enterLabel}
              <ArrowRight className="size-4" />
            </Link>
            <a
              className="inline-flex h-12 items-center justify-center rounded-md border border-primary/35 bg-primary/5 px-7 text-[15px] font-medium text-primary transition-colors hover:bg-primary/10"
              href="#power"
            >
              Explore the system
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
    <div className="erp-float relative z-10 w-full">
      <div
        aria-hidden
        className="absolute -inset-10 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.22),transparent_65%)] blur-2xl"
      />
      <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-[#0b1220]/90 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_40px_80px_-40px_rgba(34,211,238,0.55)] backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-border bg-[#070b14]/90 px-4 py-2.5">
          <span className="size-2 rounded-full bg-rose-400/80" />
          <span className="size-2 rounded-full bg-amber-400/80" />
          <span className="size-2 rounded-full bg-primary/90" />
          <span className="ml-3 font-mono text-[11px] tracking-wide text-primary/80">
            {PRODUCT_NAME} · live books
          </span>
        </div>
        <div className="grid grid-cols-[0.34fr_0.66fr]">
          <aside className="space-y-1 border-r border-border bg-[#070b14]/70 p-2.5">
            {[
              { icon: LayoutGrid, label: 'Apps', on: true },
              { icon: Receipt, label: 'Sales' },
              { icon: ShoppingCart, label: 'Purchases' },
              { icon: Boxes, label: 'Inventory' },
              { icon: Warehouse, label: 'Stores' },
              { icon: BookOpen, label: 'Accounting' },
              { icon: ChartColumnIncreasing, label: 'Reports' },
            ].map(({ icon: Icon, label, on }) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] ${
                  on ? 'bg-primary/15 text-primary' : 'text-slate-400'
                }`}
              >
                <Icon className="size-3.5 shrink-0" />
                <span>{label}</span>
              </div>
            ))}
          </aside>
          <div className="space-y-3 p-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/70">
                This month
              </p>
              <p className="mt-1 text-[1.35rem] font-semibold tracking-tight text-foreground">
                Profit &amp; Loss
              </p>
            </div>
            <div className="space-y-2">
              {[
                ['Income', '84%'],
                ['Cost of sales', '52%'],
                ['Expenses', '31%'],
              ].map(([label, width]) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                    <span>{label}</span>
                    <span className="tabular-nums text-slate-200">{width}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-primary" style={{ width }} />
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
                <div
                  key={label}
                  className="border border-border/80 bg-[#070b14]/60 px-3 py-2.5"
                >
                  <p className="text-[10px] text-slate-500">{label}</p>
                  <p className="mt-0.5 text-[1.05rem] font-semibold text-foreground">{value}</p>
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
      <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
        {eyebrow}
      </span>
      <h2 className="erp-display mt-3 text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground sm:text-[2.55rem]">
        {title}
      </h2>
      <p className="mt-4 text-[16px] leading-[1.7] text-muted-foreground">{body}</p>
    </div>
  )
}

function WorkPower() {
  return (
    <section id="power" className="scroll-mt-20 border-t border-border/70 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="System power"
          title="Everything the company does — one posted trail."
          body={`${PRODUCT_NAME} is not a pile of apps glued together. Sell, buy, stock, till, bank, jobs, and people all land in the same double-entry books.`}
        />

        <ol className="mt-14">
          {WORK_LANES.map(({ title, body }, index) => (
            <li
              key={title}
              className="erp-lane group grid gap-3 border-t border-border/70 py-8 sm:grid-cols-[6.5rem_1fr] sm:gap-10"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <span className="font-mono text-[12px] font-bold tracking-[0.2em] text-primary/80 transition-colors group-hover:text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="text-[1.25rem] font-semibold tracking-tight text-foreground">
                  {title}
                </h3>
                <p className="mt-2 max-w-3xl text-[15px] leading-[1.75] text-muted-foreground">
                  {body}
                </p>
              </div>
            </li>
          ))}
          <div className="border-t border-border/70" />
        </ol>
      </div>
    </section>
  )
}

function Modules() {
  return (
    <section
      id="modules"
      className="scroll-mt-20 border-t border-border/70 bg-[#070b14]/80 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Full module map"
          title="Every desk — one cyan signal underneath."
          body="Turn apps on or off per company. Core trade, stock, and books come ready; projects, HR, sign, and vertical desks open when you need them."
        />

        <ul className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border/40 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ icon: Icon, name, body }, index) => (
            <li
              key={name}
              className="erp-module bg-[#0b1220] p-6 transition-colors hover:bg-[#0e1628]"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <span className="inline-flex size-9 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <h3 className="mt-4 text-[1.05rem] font-semibold tracking-tight text-foreground">
                {name}
              </h3>
              <p className="mt-2 text-[13.5px] leading-[1.65] text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Workflow() {
  return (
    <section id="how" className="scroll-mt-20 border-t border-border/70 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="How work moves"
          title="From the counter to closed books."
          body="Short path on purpose: open the company, record what happened, trust the statements that fall out of the ledger."
        />
        <ol className="mt-14 grid gap-8 lg:grid-cols-3">
          {WORKFLOW.map(({ step, title, body }) => (
            <li key={step} className="relative border-l-2 border-primary/40 pl-5">
              <span className="erp-display text-[2.75rem] font-semibold leading-none tracking-tight text-primary/35">
                {step}
              </span>
              <h3 className="mt-3 text-[1.2rem] font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-[14.5px] leading-[1.7] text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Pricing({ signedIn }: { signedIn: boolean }) {
  return (
    <section
      id="pricing"
      className="scroll-mt-20 border-t border-border/70 bg-[#070b14]/60 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="For companies"
          title="Start free. Pay rent when you are ready."
          body="Create a company in minutes — 14 days free. After the trial, pick a plan and pay by EVC, Zaad, eDahab, or bank."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <article className="border border-primary/30 bg-primary/5 p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                Free trial
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-foreground">14 days</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Full company database — sales, purchases, inventory, POS, projects, and reports.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-400">
                <li>· Separate books per company</li>
                <li>· Choose which apps you need</li>
                <li>· Backup and restore</li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  href={signedIn ? '/databases?create=1' : '/register'}
                  className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90"
                >
                  {signedIn ? 'Create company' : 'Start free trial'}
                </Link>
                {!signedIn ? (
                  <Link
                    href={LOGIN_COMPANY}
                    className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:border-primary/40"
                  >
                    Company login
                  </Link>
                ) : null}
              </div>
            </article>

            <article className="border border-border/80 bg-[#0b1220] p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                After trial
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-foreground">Paid rent</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Choose a plan in Billing, pay by mobile money or bank, submit your reference. Rent
                and seats extend when confirmed.
              </p>
              {signedIn ? (
                <div className="mt-6">
                  <Link
                    href="/billing"
                    className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:border-primary/40"
                  >
                    Open Billing
                  </Link>
                </div>
              ) : null}
            </article>
          </div>
          <PricingLeadForm />
        </div>
      </div>
    </section>
  )
}

function Tutorials() {
  return (
    <section id="tutorials" className="scroll-mt-20 border-t border-border/70 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Sida loo isticmaalo · AI videos"
          title="Watch the demos. Then run the desk."
          body={`Five short AI videos about ${PRODUCT_NAME} — sign in, sell, buy, run the till, and close the month.`}
        />
        <AiDemoPlayer videos={AI_DEMO_VIDEOS} />
      </div>
    </section>
  )
}

function Contact({ contact }: { contact: MarketingContact }) {
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
      hint: 'Product support',
    },
  ]

  return (
    <section id="contact" className="scroll-mt-20 border-t border-border/70 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="relative overflow-hidden border border-primary/20 bg-[#0b1220]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_80%_at_0%_0%,rgba(34,211,238,0.16),transparent_55%)]"
          />
          <div className="relative grid gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <SectionHeading
              eyebrow="Contact · La soo xiriir"
              title={`${PRODUCT_NAME} support`}
              body={`${contact.contactName} — training, a new company database, or the full system. For the shop in Kismaayo, visit Al Furaat Plastic Center.`}
            />
            <div className="flex flex-wrap gap-3">
              <a
                className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-6 text-[15px] font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"
                href={waHref}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="size-4" />
                WhatsApp
              </a>
              <a
                className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-6 text-[15px] font-medium text-foreground hover:border-primary/40"
                href={telUrl(contact.phone)}
              >
                <Phone className="size-4" />
                Call
              </a>
              <Link
                className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-6 text-[15px] font-medium text-foreground hover:border-primary/40"
                href={STORE_PATH}
              >
                <MapPin className="size-4" />
                Al Furaat shop
              </Link>
            </div>
          </div>
          <dl className="relative grid gap-px border-t border-border/70 bg-border/30 sm:grid-cols-3">
            {rows.map(({ icon: Icon, term, detail, href, hint }) => (
              <a
                key={`${term}-${detail}`}
                href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noreferrer' : undefined}
                className="flex items-start gap-3.5 bg-[#0b1220] px-5 py-5 transition-colors hover:bg-[#0e1628]"
              >
                <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center justify-between gap-2">
                    <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      {term}
                    </dt>
                    <span className="text-[11px] text-primary/80">{hint}</span>
                  </span>
                  <dd className="mt-1.5 break-words text-[15px] font-semibold text-foreground">
                    {detail}
                  </dd>
                </span>
              </a>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

function SignInDoors({ signedIn }: { signedIn: boolean }) {
  if (signedIn) return null

  return (
    <section id="sign-in" className="border-t border-border/70 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="SOM ERP login"
          title="Three doors — go straight to yours"
          body="Staff, company users, and customers each open their own login."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {LOGIN_DOORS.map((door) => (
            <Link
              key={door.href}
              href={door.href}
              className="group flex flex-col border border-border/80 bg-[#0b1220] p-5 transition-colors hover:border-primary/40"
            >
              <span className="text-[15px] font-semibold text-foreground">{door.title}</span>
              <span className="mt-2 flex-1 text-[14px] leading-relaxed text-muted-foreground">
                {door.description}
              </span>
              <span className="mt-4 font-mono text-[12px] text-primary">{door.path}</span>
              <span className="mt-3 text-[13px] font-medium text-primary group-hover:underline">
                Open {door.short.toLowerCase()} login →
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-[13px] text-muted-foreground">
          All options:{' '}
          <Link href={LOGIN_HUB} className="font-mono text-primary hover:underline">
            {LOGIN_HUB}
          </Link>
        </p>
      </div>
    </section>
  )
}

function Cta({ enterHref, enterLabel }: { enterHref: string; enterLabel: string }) {
  return (
    <section className="border-t border-border/70 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="relative overflow-hidden border border-primary/25 bg-[#0b1220] px-7 py-14 sm:px-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_100%_at_100%_0%,rgba(34,211,238,0.18),transparent_55%)]"
          />
          <div className="relative max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
              Get started
            </p>
            <h2 className="erp-display mt-3 text-[2.1rem] font-semibold tracking-[-0.035em] text-foreground sm:text-[2.6rem]">
              Start a company on {PRODUCT_NAME}.
            </h2>
            <p className="mt-4 text-[16px] leading-[1.7] text-muted-foreground">
              Create your company, get 14 days free, and open the full desk — sales, stock, POS,
              projects, and books.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-7 text-[15px] font-bold text-primary-foreground hover:opacity-90"
                href={enterHref}
              >
                {enterLabel}
                <ArrowRight className="size-4" />
              </Link>
              <Link
                className="inline-flex h-12 items-center justify-center rounded-md border border-border px-7 text-[15px] font-medium text-foreground hover:border-primary/40"
                href={LOGIN_COMPANY}
              >
                Company login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SiteFooter({ contact }: { contact: MarketingContact }) {
  return (
    <footer className="border-t border-border/70 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 sm:px-8 md:flex-row md:items-center">
        <ProductWordmark size="sm" />
        <div className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[13px] text-muted-foreground">
          <a className="transition-colors hover:text-primary" href="#power">
            Capabilities
          </a>
          <a className="transition-colors hover:text-primary" href="#tutorials">
            How to use
          </a>
          <a className="transition-colors hover:text-primary" href="#contact">
            Contact
          </a>
          {LOGIN_DOORS.map((door) => (
            <Link
              key={door.href}
              className="transition-colors hover:text-primary"
              href={door.href}
            >
              {door.short}
            </Link>
          ))}
          <a className="transition-colors hover:text-primary" href={telUrl(contact.phone)}>
            {contact.phone}
          </a>
        </div>
        <p className="text-[12px] text-slate-500">
          &copy; {new Date().getFullYear()} {PRODUCT_NAME}
          <span className="mx-1.5 text-slate-700">·</span>
          {PRODUCT_BUILDER}
          <span className="mx-1.5 text-slate-700">·</span>
          <Link href={STORE_PATH} className="hover:text-primary">
            Al Furaat shop
          </Link>
        </p>
      </div>
    </footer>
  )
}

const landingCss = `
  .erp-landing {
    font-family: var(--font-marketing-sans), var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
    color-scheme: dark;
  }
  .erp-display {
    font-family: var(--font-marketing-display), ui-serif, Georgia, serif;
  }
  .erp-scan {
    background-image:
      linear-gradient(to right, rgba(34,211,238,0.07) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(148,163,184,0.05) 1px, transparent 1px);
    background-size: 64px 40px;
    mask-image: radial-gradient(80% 70% at 75% 20%, black, transparent);
  }
  .erp-beam {
    background: linear-gradient(180deg, rgba(34,211,238,0.14), transparent 70%);
    filter: blur(40px);
  }
  @keyframes erp-fade-up {
    from { opacity: 0; transform: translateY(22px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes erp-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  .erp-fade { animation: erp-fade-up 800ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  .erp-float { animation: erp-float 8s ease-in-out infinite; }
  .erp-lane, .erp-module { animation: erp-fade-up 700ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  @media (prefers-reduced-motion: reduce) {
    .erp-fade, .erp-float, .erp-lane, .erp-module { animation: none; }
  }
`
