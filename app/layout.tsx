import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Inter, Source_Sans_3 } from "next/font/google"

import { Providers } from "@/components/providers"
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/product-brand"
import { resolveSiteUrl } from "@/lib/site-url"
import "./globals.css"
import { Analytics } from "@vercel/analytics/next"

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
/** Odoo brand typeface — applied when the Odoo / Odoo Dark theme is selected. */
const inter = Inter({ variable: "--font-odoo", subsets: ["latin"] })
/** QuickBooks Online report typeface — used when report style is QuickBooks. */
const sourceSans = Source_Sans_3({ variable: "--font-quickbooks", subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  applicationName: PRODUCT_NAME,
  description: PRODUCT_DESCRIPTION,
}

/** Fit phone and desktop browsers; layout scales to the viewport width. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-report-style="herobooks"
      data-font-size="md"
      data-font-style="default"
    >
      <body className={`${sans.variable} ${mono.variable} ${inter.variable} ${sourceSans.variable} antialiased`}>
        <Providers>
          <Analytics />
          {children}
        </Providers>
      </body>
    </html>
  )
}
