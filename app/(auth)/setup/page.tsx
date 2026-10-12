import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

/**
 * Legacy first-run URL. Self-serve lives at `/register` (SOM ERP multi-company).
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Set up' }

export default function SetupPage() {
  redirect('/register')
}
