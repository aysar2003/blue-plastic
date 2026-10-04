'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'

import { THEME_IDS } from '@/lib/themes'

/**
 * The only global client boundary in the application. Everything below it is a
 * Server Component unless it says otherwise.
 *
 * Deliberately thin: a provider here is downloaded and executed before any page
 * can render, on every route. The data-fetching cache is *not* here — it is
 * mounted by the one screen that needs it. See providers/query-provider.tsx.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="ocean"
      enableSystem={false}
      themes={[...THEME_IDS]}
      disableTransitionOnChange
    >
      {children}
      <Toaster richColors closeButton position="bottom-right" />
    </ThemeProvider>
  )
}
