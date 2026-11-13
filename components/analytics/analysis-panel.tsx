import Link from 'next/link'

import type { AnalyticsBrief } from '@/lib/analytics-brief'
import { cn } from '@/lib/utils'

export function AnalysisPanel({ brief }: { brief: AnalyticsBrief }) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card/90 shadow-sm">
      <header className="border-b border-border/60 px-5 py-4">
        <p className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
          Analysis
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          What the numbers say
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{brief.summary}</p>
      </header>

      <div className="grid gap-6 px-5 py-5 lg:grid-cols-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Highlights
          </h3>
          <ul className="mt-3 space-y-3">
            {brief.highlights.map((item) => (
              <li key={item.id} className="rounded-xl bg-muted/40 px-3 py-2.5">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risks</h3>
          {brief.risks.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No material risks flagged for this period.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {brief.risks.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'rounded-xl border px-3 py-2.5',
                    item.severity === 'high' && 'border-[color:var(--chart-expense,#C2410C)]/40 bg-[color:var(--chart-expense,#C2410C)]/5',
                    item.severity === 'medium' && 'border-amber-500/30 bg-amber-500/5',
                    item.severity === 'low' && 'border-border bg-muted/30',
                  )}
                >
                  <p className="text-sm font-medium text-foreground">
                    <span className="mr-2 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                      {item.severity}
                    </span>
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Suggested next steps
          </h3>
          <ul className="mt-3 space-y-3">
            {brief.actions.map((item) => (
              <li key={item.id} className="rounded-xl border border-border/70 px-3 py-2.5">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60 px-5 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Narratives for AI
        </h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              ['Profit', brief.narrative.profit],
              ['Cash', brief.narrative.cash],
              ['Sales', brief.narrative.sales],
              ['Receivables', brief.narrative.receivables],
              ['Spending', brief.narrative.spending],
            ] as const
          ).map(([label, text]) => (
            <div key={label} className="rounded-xl bg-muted/30 px-3 py-2.5">
              <dt className="text-xs font-medium text-foreground">{label}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

export function AnalyticsBriefEmbed({ brief }: { brief: AnalyticsBrief }) {
  return (
    <script
      type="application/json"
      id="analytics-brief"
      // Structured payload for AI agents / page tools — not executed.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(brief) }}
    />
  )
}
