import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { FontAppearancePicker } from '@/components/appearance/font-controls'
import { ReportStylePicker } from './report-style-picker'
import { ThemePicker } from './theme-picker'
import { WebsiteLookPicker } from './website-look-picker'

export const metadata: Metadata = { title: 'Appearance' }

function SectionHeading({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="relative space-y-1.5 pl-3">
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0 w-0.5 rounded-full bg-gradient-to-b from-primary via-primary/70 to-transparent"
      />
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

export default function AppearancePage() {
  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <SectionHeading title="System look">
          Default is <strong className="font-medium text-foreground">SOM ERP</strong> (light paper +
          cyan). Pick <strong className="font-medium text-foreground">SOM Dark</strong> for the navy
          night desk, <strong className="font-medium text-foreground">Odoo</strong> / a colour shell,
          or VIP skins — <strong className="font-medium text-foreground">AI</strong> neural midnight,
          and <strong className="font-medium text-foreground">Luxury</strong> champagne gold end-to-end
          (desk, reports, POS, login, print). Saved in this browser.
        </SectionHeading>
        <ThemePicker />
      </div>

      <div className="space-y-4 border-t border-border/70 pt-8">
        <SectionHeading title="Website look">
          Colours for the public landing page and login. Choose{' '}
          <strong className="font-medium text-foreground">Match system</strong> so the website uses
          the same palette as the books above, or{' '}
          <strong className="font-medium text-foreground">Product website</strong> for the navy and
          cyan marketing skin. Saved in this browser.
        </SectionHeading>
        <WebsiteLookPicker />
      </div>

      <div className="space-y-4 border-t border-border/70 pt-8">
        <SectionHeading title="Font size and style">
          Pick from more sizes and typefaces, or set your own pixel size and CSS font stack. The same
          choices appear on report toolbars and the chart of accounts.
        </SectionHeading>
        <FontAppearancePicker />
      </div>

      <div className="space-y-4 border-t border-border/70 pt-8">
        <SectionHeading title="Report paper only">
          Override just the report sheet — SOM ERP, world clones, ambient presets, plus a custom
          sheet / band / accent picker. VIP skins (<strong className="font-medium text-foreground">Luxury</strong>{' '}
          / <strong className="font-medium text-foreground">AI</strong>) keep their matching paper while
          that System look is on. Font size and style above still apply unless style is Theme default.
        </SectionHeading>
        <ReportStylePicker />
      </div>
    </div>
  )
}
