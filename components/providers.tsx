'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'

import { UiFontProvider } from '@/components/appearance/ui-font-provider'
import { WebsiteLookProvider } from '@/components/appearance/website-look-provider'
import { ReportStyleProvider } from '@/components/reports/report-style-provider'
import { ForbiddenWatcher } from '@/components/system/forbidden-watcher'
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
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="som"
        enableSystem={false}
        themes={[...THEME_IDS]}
        disableTransitionOnChange
      >
        <ReportStyleProvider />
        <WebsiteLookProvider />
        <UiFontProvider />
        {children}
        <ForbiddenWatcher />
        <Toaster richColors closeButton position="bottom-right" />
      </ThemeProvider>
    </SessionProvider>
  )
}
