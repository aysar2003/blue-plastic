import type { Metadata } from 'next'

import { ThemePicker } from './theme-picker'

export const metadata: Metadata = { title: 'Appearance' }

export default function AppearancePage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose colours for the whole system — home, lists, forms, reports, and POS.{' '}
          <strong className="font-medium text-foreground">Odoo</strong> and{' '}
          <strong className="font-medium text-foreground">Odoo Dark</strong> apply the full brand
          skin: purple top bar (#714B67), teal accents (#017E84), Inter type, flat panels. Pick one
          again if another theme was saved in this browser earlier.
        </p>
      </div>
      <ThemePicker />
    </div>
  )
}
