import type { LauncherTile } from '@/components/layout/app-launcher'
import { StandardReportSections } from '@/components/reports/standard-report-sections'

/**
 * A module's reports as one list of names. Each name opens that report.
 */
export function ModuleReportList({
  eyebrow,
  title,
  subtitle,
  apps,
}: {
  eyebrow: string
  title: string
  subtitle: string
  apps: LauncherTile[]
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-[clamp(0.75rem,2vw,2.5rem)] pb-16 pt-8 sm:pt-12">
      <div className="mb-8 text-center sm:mb-10">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <StandardReportSections headings={false} sections={[{ label: title, apps }]} />
    </div>
  )
}
