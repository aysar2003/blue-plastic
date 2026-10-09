import { PRODUCT_MARK, PRODUCT_NAME, PRODUCT_TAGLINE } from '@/lib/product-brand'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          {PRODUCT_MARK}
        </span>
        <span className="text-lg font-semibold tracking-tight">{PRODUCT_NAME}</span>
      </div>
      {children}
      <p className="mt-6 text-xs text-muted-foreground">{PRODUCT_TAGLINE}</p>
    </div>
  )
}
