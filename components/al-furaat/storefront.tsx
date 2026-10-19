import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowUpRight,
  Droplets,
  Hammer,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Wrench,
} from 'lucide-react'
import { Archivo_Black, DM_Sans } from 'next/font/google'

import {
  DEFAULT_STORE_CONTACT,
  STORE_CATEGORIES,
  STORE_GROUP,
  STORE_HERO_IMAGE,
  STORE_NAME,
  STORE_TAGLINE,
  storeMailHref,
  storeMapsHref,
  storeOfficeLine,
  storeTelHref,
  storeWhatsAppHref,
} from '@/lib/al-furaat-site'
import type { MarketingContact } from '@/lib/marketing-site'

const display = Archivo_Black({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-furaat-display',
})

const body = DM_Sans({
  subsets: ['latin'],
  variable: '--font-furaat-body',
})

const CATEGORY_ICONS = {
  plumbing: Droplets,
  tools: Wrench,
  building: Hammer,
} as const

/**
 * Public shop site for Al Furaat Plastic Center.
 * Company colours: dark blue + solid blue — separate from SOM ERP cyan.
 */
export function AlFuraatStorefront({
  contact = DEFAULT_STORE_CONTACT,
}: {
  contact?: MarketingContact
}) {
  const wa = storeWhatsAppHref(contact)
  const tel = storeTelHref(contact)
  const mail = storeMailHref(contact)
  const maps = storeMapsHref(contact)
  const office = storeOfficeLine(contact)

  return (
    <div
      className={`${display.variable} ${body.variable} furaat-site min-h-screen text-[15px] leading-relaxed`}
    >
      <style>{furaatCss}</style>

      <header className="furaat-header sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <a href="#top" className="min-w-0">
            <span className="furaat-brand-mark block truncate text-[1.05rem] tracking-tight sm:text-[1.2rem]">
              {STORE_NAME}
            </span>
            <span className="mt-0.5 block text-[11px] uppercase tracking-[0.18em] text-[var(--f-muted)]">
              Kismaayo · Somalia
            </span>
          </a>
          <nav className="hidden items-center gap-7 text-[14px] text-[var(--f-muted)] md:flex">
            <a className="transition-colors hover:text-[var(--f-fg)]" href="#products">
              Products
            </a>
            <a className="transition-colors hover:text-[var(--f-fg)]" href="#contact">
              Contact
            </a>
          </nav>
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="furaat-btn-primary inline-flex h-10 items-center gap-2 px-4 text-[14px] font-semibold"
          >
            <MessageCircle className="size-4" />
            WhatsApp
          </a>
        </div>
      </header>

      <main id="top">
        <section className="furaat-hero relative min-h-[min(92vh,860px)] overflow-hidden">
          <Image
            src={STORE_HERO_IMAGE}
            alt="Plumbing pipes, fittings, and building supplies at Al Furaat Plastic Center"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div aria-hidden className="furaat-hero-shade" />

          <div className="relative mx-auto flex min-h-[min(92vh,860px)] max-w-6xl items-end px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-32">
            <div className="furaat-rise max-w-xl">
              <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--f-sky)]">
                {STORE_GROUP}
              </p>
              <h1 className="furaat-brand-hero mt-4 max-w-[14ch] text-[clamp(2.75rem,8vw,5.25rem)] leading-[0.92] tracking-[-0.02em]">
                {STORE_NAME}
              </h1>
              <p className="mt-6 max-w-md text-[1.15rem] leading-snug text-[var(--f-soft)] sm:text-[1.3rem]">
                {STORE_TAGLINE}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="furaat-btn-primary inline-flex h-12 items-center justify-center gap-2 px-6 text-[15px] font-semibold"
                >
                  <MessageCircle className="size-4" />
                  Order on WhatsApp
                </a>
                <a
                  href="#products"
                  className="furaat-btn-ghost inline-flex h-12 items-center justify-center px-6 text-[15px] font-medium"
                >
                  See what we sell
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="products" className="scroll-mt-20 border-t border-[var(--f-line)] py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--f-blue)]">
                Waxaan iibinaa · What we sell
              </p>
              <h2 className="furaat-brand-mark mt-3 text-[clamp(1.85rem,4vw,2.6rem)] leading-tight text-[var(--f-fg)]">
                Plumbing. Tools. Building materials.
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-[var(--f-muted)]">
                One yard for pipe work, site tools, and the build supplies contractors ask for
                every week.
              </p>
            </div>

            <ul className="mt-14 grid gap-10 lg:grid-cols-3">
              {STORE_CATEGORIES.map((cat, index) => {
                const Icon = CATEGORY_ICONS[cat.id as keyof typeof CATEGORY_ICONS] ?? Wrench
                return (
                  <li
                    key={cat.id}
                    className="furaat-category group"
                    style={{ animationDelay: `${index * 90}ms` }}
                  >
                    <div className="furaat-photo relative aspect-[4/3] overflow-hidden">
                      <Image
                        src={cat.image}
                        alt={cat.imageAlt}
                        fill
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      />
                    </div>
                    <span className="furaat-category-icon mt-6 grid size-12 place-items-center">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-4 text-[1.45rem] font-semibold tracking-tight text-[var(--f-fg)]">
                      {cat.name}
                    </h3>
                    <p className="mt-1 text-[13px] text-[var(--f-blue)]">{cat.nameSo}</p>
                    <p className="mt-4 text-[15px] leading-relaxed text-[var(--f-muted)]">
                      {cat.summary}
                    </p>
                    <ul className="mt-6 space-y-2 border-t border-[var(--f-line)] pt-5">
                      {cat.items.map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-2 text-[14px] text-[var(--f-soft)]"
                        >
                          <span className="size-1.5 shrink-0 rounded-full bg-[var(--f-blue)]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        <section id="contact" className="scroll-mt-20 border-t border-[var(--f-line)] py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="furaat-contact relative overflow-hidden px-6 py-10 sm:px-10 sm:py-14">
              <div aria-hidden className="furaat-contact-glow" />
              <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--f-blue)]">
                    La soo xiriir · Contact
                  </p>
                  <h2 className="furaat-brand-mark mt-3 text-[clamp(1.85rem,4vw,2.5rem)] leading-tight text-[var(--f-fg)]">
                    Visit the store or message us today
                  </h2>
                  <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-[var(--f-muted)]">
                    Call, WhatsApp, or email for stock, prices, and delivery around Kismaayo.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="furaat-btn-primary inline-flex h-12 items-center gap-2 px-5 text-[15px] font-semibold"
                  >
                    <MessageCircle className="size-4" />
                    WhatsApp
                  </a>
                  <a
                    href={tel}
                    className="furaat-btn-ghost inline-flex h-12 items-center gap-2 px-5 text-[15px] font-medium"
                  >
                    <Phone className="size-4" />
                    Call
                  </a>
                  <a
                    href={mail}
                    className="furaat-btn-ghost inline-flex h-12 items-center gap-2 px-5 text-[15px] font-medium"
                  >
                    <Mail className="size-4" />
                    Email
                  </a>
                </div>
              </div>

              <dl className="relative mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    icon: Phone,
                    term: 'Phone',
                    detail: formatPhone(contact.phone),
                    href: tel,
                    hint: 'Direct call',
                  },
                  {
                    icon: MessageCircle,
                    term: 'WhatsApp',
                    detail: formatPhone(contact.whatsappE164),
                    href: wa,
                    hint: 'Chat now',
                  },
                  {
                    icon: Mail,
                    term: 'Email',
                    detail: contact.email,
                    href: mail,
                    hint: 'Shop',
                  },
                  ...(contact.secondaryEmail
                    ? [
                        {
                          icon: Mail,
                          term: 'Office email',
                          detail: contact.secondaryEmail,
                          href: storeMailHref(
                            { ...contact, email: contact.secondaryEmail },
                            `${STORE_NAME} office`,
                          ),
                          hint: 'Office',
                        },
                      ]
                    : []),
                  {
                    icon: MapPin,
                    term: 'Office',
                    detail: office.replace(/,\s*,/g, ','),
                    href: maps,
                    hint: 'Open map',
                  },
                ].map(({ icon: Icon, term, detail, href, hint }, index) => (
                  <a
                    key={`${term}-${detail}`}
                    href={href}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel={href.startsWith('http') ? 'noreferrer' : undefined}
                    className="furaat-contact-card flex items-start gap-3.5 px-4 py-4"
                    style={{ animationDelay: `${index * 55}ms` }}
                  >
                    <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--f-chip)] text-[var(--f-blue)] ring-1 ring-[var(--f-line)]">
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--f-muted)]">
                          {term}
                        </dt>
                        <span className="text-[11px] text-[var(--f-sky)]">{hint}</span>
                      </span>
                      <dd className="mt-1.5 break-words text-[15px] font-semibold leading-snug text-[var(--f-fg)]">
                        {detail}
                      </dd>
                    </span>
                  </a>
                ))}
              </dl>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--f-line)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="furaat-brand-mark text-[1.05rem] text-[var(--f-fg)]">{STORE_NAME}</p>
            <p className="mt-1 text-[13px] text-[var(--f-muted)]">
              &copy; {new Date().getFullYear()} {STORE_GROUP}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-[var(--f-muted)]">
            <a className="hover:text-[var(--f-fg)]" href={tel}>
              {formatPhone(contact.phone)}
            </a>
            <a className="hover:text-[var(--f-fg)]" href={mail}>
              {contact.email}
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-1 hover:text-[var(--f-fg)]"
            >
              SOM ERP
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('252')) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }
  return raw
}

const furaatCss = `
  .furaat-site {
    --f-bg: #0a1220;
    --f-fg: #eef4ff;
    --f-soft: #d7e4f7;
    --f-muted: #8fa3c1;
    --f-blue: #3b82f6;
    --f-sky: #93c5fd;
    --f-line: rgb(148 180 230 / 0.16);
    --f-chip: rgb(59 130 246 / 0.14);
    --f-surface: #101a2c;
    --f-surface-2: #152238;
    font-family: var(--font-furaat-body), ui-sans-serif, system-ui, sans-serif;
    background:
      radial-gradient(90% 70% at 100% -10%, rgb(59 130 246 / 0.22), transparent 50%),
      radial-gradient(70% 50% at 0% 100%, rgb(30 64 175 / 0.2), transparent 45%),
      linear-gradient(180deg, #0d1728 0%, var(--f-bg) 40%, #070d18 100%);
    color: var(--f-fg);
  }
  .furaat-brand-mark,
  .furaat-brand-hero {
    font-family: var(--font-furaat-display), var(--font-furaat-body), sans-serif;
  }
  .furaat-brand-hero {
    color: #f4f8ff;
    text-shadow: 0 2px 40px rgb(59 130 246 / 0.28);
  }
  .furaat-header {
    border-bottom: 1px solid var(--f-line);
    background: color-mix(in oklab, var(--f-bg) 82%, transparent);
    backdrop-filter: blur(16px);
  }
  .furaat-btn-primary {
    border-radius: 0.35rem;
    background: linear-gradient(180deg, #60a5fa 0%, var(--f-blue) 100%);
    color: #06101f;
    box-shadow: 0 14px 36px -18px rgb(59 130 246 / 0.85);
    transition: transform 180ms ease, filter 180ms ease;
  }
  .furaat-btn-primary:hover {
    transform: translateY(-1px);
    filter: brightness(1.05);
  }
  .furaat-btn-ghost {
    border-radius: 0.35rem;
    border: 1px solid var(--f-line);
    background: rgb(255 255 255 / 0.03);
    color: var(--f-fg);
    transition: border-color 180ms ease, background 180ms ease;
  }
  .furaat-btn-ghost:hover {
    border-color: rgb(59 130 246 / 0.5);
    background: rgb(59 130 246 / 0.1);
  }
  .furaat-hero-shade {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgb(7 13 24 / 0.92) 0%, rgb(7 13 24 / 0.72) 42%, rgb(7 13 24 / 0.35) 100%),
      linear-gradient(180deg, rgb(7 13 24 / 0.55) 0%, transparent 35%, rgb(7 13 24 / 0.88) 100%);
  }
  .furaat-photo {
    border-radius: 0.35rem;
    box-shadow: inset 0 0 0 1px var(--f-line);
    background: var(--f-surface);
  }
  .furaat-category {
    animation: furaat-rise 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .furaat-category .furaat-photo {
    border-bottom: 3px solid var(--f-blue);
  }
  .furaat-category-icon {
    border-radius: 0.65rem;
    background: var(--f-chip);
    color: var(--f-sky);
    box-shadow: inset 0 0 0 1px var(--f-line);
  }
  .furaat-contact {
    border-radius: 1rem;
    border: 1px solid var(--f-line);
    background: linear-gradient(160deg, var(--f-surface-2), var(--f-surface));
  }
  .furaat-contact-glow {
    pointer-events: none;
    position: absolute;
    inset: 0;
    background:
      radial-gradient(70% 80% at 0% 0%, rgb(59 130 246 / 0.18), transparent 55%),
      radial-gradient(55% 60% at 100% 100%, rgb(30 64 175 / 0.14), transparent 50%);
  }
  .furaat-contact-card {
    border-radius: 0.75rem;
    border: 1px solid var(--f-line);
    background: rgb(0 0 0 / 0.22);
    transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
    animation: furaat-rise 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .furaat-contact-card:hover {
    transform: translateY(-2px);
    border-color: rgb(59 130 246 / 0.5);
    background: rgb(59 130 246 / 0.1);
  }
  .furaat-rise {
    animation: furaat-rise 750ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .furaat-rise-delay {
    animation-delay: 120ms;
  }
  @keyframes furaat-rise {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .furaat-rise, .furaat-rise-delay, .furaat-category, .furaat-contact-card {
      animation: none;
    }
    .furaat-category .group-hover\\:scale-\\[1\\.04\\],
    .furaat-category img {
      transform: none !important;
    }
  }
`
