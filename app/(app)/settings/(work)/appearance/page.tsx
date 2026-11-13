import type { Metadata } from 'next'

import { FontAppearancePicker } from '@/components/appearance/font-controls'
import { ReportStylePicker } from './report-style-picker'
import { ThemePicker } from './theme-picker'
import { WebsiteLookPicker } from './website-look-picker'

export const metadata: Metadata = { title: 'Appearance' }

export default function AppearancePage() {
  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">System look</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Default is <strong className="font-medium text-foreground">SOM ERP</strong> (light paper +
            cyan). Pick <strong className="font-medium text-foreground">SOM Dark</strong> for the navy
            night desk, or <strong className="font-medium text-foreground">Odoo</strong> / a colour
            shell (including AI) for the whole system. Saved in this browser.
          </p>
        </div>
        <ThemePicker />
      </div>

      <div className="space-y-4 border-t pt-8">
        <div>
          <h2 className="text-base font-semibold">Website look</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Colours for the public landing page and login. Choose{' '}
            <strong className="font-medium text-foreground">Match system</strong> so the website
            uses the same palette as the books above, or{' '}
            <strong className="font-medium text-foreground">Product website</strong> for the navy
            and cyan marketing skin. Saved in this browser.
          </p>
        </div>
        <WebsiteLookPicker />
      </div>

      <div className="space-y-4 border-t pt-8">
        <div>
          <h2 className="text-base font-semibold">Font size and style</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Change how large type is and which typeface every part of the system uses — the same
            choices appear on report toolbars and the chart of accounts.
          </p>
        </div>
        <FontAppearancePicker />
      </div>

      <div className="space-y-4 border-t pt-8">
        <div>
          <h2 className="text-base font-semibold">Report paper only</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Override just the report sheet (row bands, section headers) without changing the rest of
            the system. Odoo themes set a matching paper; change it here if you want a different
            sheet look. Font size and style above still apply unless you leave style on Theme
            default.
          </p>
        </div>
        <ReportStylePicker />
      </div>
    </div>
  )
}
