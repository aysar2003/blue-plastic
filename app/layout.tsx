import type { Metadata } from "next"
import { Geist, Geist_Mono, Inter } from "next/font/google"

import { Providers } from "@/components/providers"
import "./globals.css"
import { Analytics } from "@vercel/analytics/next"

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
/** Odoo brand typeface — applied when the Odoo / Odoo Dark theme is selected. */
const inter = Inter({ variable: "--font-odoo", subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: "Blue Plastic Center",
    template: "%s · Blue Plastic Center",
  },
  description: "Double-entry accounting for Blue Plastic Center.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} ${inter.variable} antialiased`}>
        <Providers>
          <Analytics />
          {children}
        </Providers>
      </body>
    </html>
  )
}
