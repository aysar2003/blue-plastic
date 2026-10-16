import Link from 'next/link'

import { ProductWordmark } from '@/components/marketing/product-wordmark'
import { WebsiteShell } from '@/components/marketing/website-shell'
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '@/lib/product-brand'

/**
 * Auth screens share the marketing brand language with the landing page:
 * one wordmark, one short line, then the form — not a second marketing stack.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebsiteShell className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_-10%,color-mix(in_oklab,var(--success)_18%,transparent),transparent_55%),radial-gradient(50%_40%_at_90%_90%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_50%)]"
      />

      <div className="relative flex w-full max-w-md flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <ProductWordmark size="lg" />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{PRODUCT_TAGLINE}</p>
        </div>

        <div className="w-full">{children}</div>

        <Link
          href="/"
          className="text-[0.75rem] font-medium text-success transition-colors hover:opacity-80"
        >
          ← Back to {PRODUCT_NAME}
        </Link>
      </div>
    </WebsiteShell>
  )
}
