/**
 * The strip at the top of every screen: what this is, and what can be done to
 * it. Odoo calls it the control panel and puts it in exactly this place, which
 * is why the primary action is always in the same spot however deep you are.
 *
 * The description is one line of plain English about what the screen shows —
 * kept because half the value of an accounting system is knowing what a figure
 * means before you rely on it.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`mb-4 flex flex-wrap items-start justify-between gap-3 border-b pb-3 ${className ?? ''}`}>
      <div className="min-w-0">
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  )
}
