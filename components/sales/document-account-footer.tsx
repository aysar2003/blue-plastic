import type { DocumentTemplate } from '@/lib/document-template'

/**
 * The lower block of an invoice or a bill: the company's accounts, written in
 * Settings → Templates. The layout is one of three, chosen there.
 */
export function DocumentAccountFooter({
  template,
  accent,
}: {
  template: DocumentTemplate
  accent: string
}) {
  const lines = template.banks.filter((bank) => bank.name || bank.account)
  const note = template.footerNote.trim()
  if (lines.length === 0 && !note) return null

  const title = template.footerTitle.trim() || 'Account'
  const layout = template.footerLayout

  const body = (
    <>
      <p
        className="text-[11px] font-bold uppercase tracking-[0.14em]"
        style={{ color: layout === 'band' ? '#ffffff' : accent }}
      >
        {title}
      </p>
      {lines.length > 0 ? (
        <dl className="mt-1 space-y-0.5">
          {lines.map((bank) => (
            <div key={`${bank.name}-${bank.account}`} className="flex justify-between gap-4">
              <dt>{bank.name}</dt>
              <dd className="tabular">{bank.account}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {note ? <p className="mt-2 whitespace-pre-wrap text-[12px] leading-snug">{note}</p> : null}
    </>
  )

  if (layout === 'band') {
    return (
      <div className="mx-8 mb-2 rounded px-4 py-3 text-[12px] text-white" style={{ background: accent }}>
        {body}
      </div>
    )
  }

  if (layout === 'bottom') {
    return <div className="mx-8 mb-2 border-t pt-3 text-[12px] text-[#3d4c5c]">{body}</div>
  }

  return <div className="text-[12px]">{body}</div>
}
