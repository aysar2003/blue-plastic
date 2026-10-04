/**
 * The customer or vendor block on a document.
 * One wash everywhere, a step darker than the white sheet.
 */
export function PartyInfo({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1 space-y-4 rounded-xl bg-slate-200/80 px-4 py-4 ring-1 ring-slate-300/70">
      {children}
    </div>
  )
}
