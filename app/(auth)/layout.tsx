import Link from 'next/link'

import { WebsiteShell } from '@/components/marketing/website-shell'
import {
  PRODUCT_KIND,
  PRODUCT_MARK,
  PRODUCT_NAME,
  PRODUCT_PROMO,
  PRODUCT_TAGLINE,
} from '@/lib/product-brand'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebsiteShell className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_-10%,color-mix(in_oklab,var(--success)_18%,transparent),transparent_55%),radial-gradient(50%_40%_at_90%_90%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_50%)]"
      />

      <div className="relative mb-8 flex flex-col items-center gap-3 text-center">
        <Link
          href="/"
          className="grid size-12 place-items-center rounded-md bg-primary text-sm font-bold tracking-wide text-primary-foreground shadow-[0_10px_28px_-12px_var(--glow)]"
        >
          {PRODUCT_MARK}
        </Link>
        <div className="space-y-1">
          <Link href="/" className="block text-xl font-semibold tracking-tight text-foreground">
            {PRODUCT_NAME}
          </Link>
          <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-success">
            {PRODUCT_KIND}
          </span>
        </div>
      </div>

      <div className="relative w-full max-w-lg">{children}</div>

      <div className="relative mt-8 max-w-sm space-y-2 text-center">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-success">
          {PRODUCT_KIND}
        </p>
        <p className="text-xs text-muted-foreground">{PRODUCT_TAGLINE}</p>
        <ul className="space-y-1 text-[0.7rem] leading-relaxed text-muted-foreground">
          {PRODUCT_PROMO.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <Link
          href="/"
          className="mt-4 inline-block text-[0.7rem] font-medium text-success transition-colors hover:opacity-80"
        >
          ← Back to {PRODUCT_NAME}
        </Link>
      </div>
    </WebsiteShell>
  )
}
