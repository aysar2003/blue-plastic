import type { Metadata } from 'next'

import { ThemePicker } from './theme-picker'

export const metadata: Metadata = { title: 'Appearance' }

export default function AppearancePage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The theme colours every screen: the home, the lists, the forms and the reports. Lagoon is the
          teal shell. Ink is black, white, and gray. The choice stays on this browser until you choose
          another.
        </p>
      </div>
      <ThemePicker />
    </div>
  )
}
