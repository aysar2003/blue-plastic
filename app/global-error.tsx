'use client'

import { PRODUCT_NAME } from '@/lib/product-brand'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#fff', color: '#111' }}>
        <main style={{ maxWidth: 32 * 16, margin: '0 auto', padding: '4rem 1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{PRODUCT_NAME} is unavailable</h1>
          <p style={{ lineHeight: 1.5, color: '#444' }}>
            The application failed before it could draw a page. Check DATABASE_URL, DIRECT_URL, and AUTH_SECRET on
            the deployment, and run migrations with pnpm db:deploy.
          </p>
          {error.digest ? (
            <p style={{ fontSize: '0.8rem', color: '#666' }}>
              Reference <span style={{ fontFamily: 'ui-monospace, monospace' }}>{error.digest}</span>
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: '1rem', padding: '0.4rem 0.8rem', borderRadius: 6, border: '1px solid #ccc' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
