import { cn } from '@/lib/utils'

/** Visual mock of a sales / report / receipt layout — for Settings → Templates. */
export type TemplatePreviewKind =
  | 'sheet'
  | 'invoice'
  | 'classic'
  | 'service'
  | 'modern'
  | 'standard'
  | 'compact'
  | 'plain'
  | '80'
  | '58'
  | 'document'
  | 'trade'
  | 'generic'

export function TemplateLayoutPreview({
  kind,
  accent = '#1eb8ae',
  className,
  size = 'thumb',
}: {
  kind: string
  accent?: string
  className?: string
  size?: 'thumb' | 'stage'
}) {
  const resolved = resolveKind(kind)
  const tall = size === 'stage'

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-white text-slate-800 shadow-sm',
        tall ? 'min-h-[22rem] w-full max-w-md' : 'h-20 w-full',
        className,
      )}
      aria-hidden
    >
      {resolved === 'sheet' ? <SheetMock accent={accent} tall={tall} /> : null}
      {resolved === 'invoice' ? <OfficeMock tall={tall} /> : null}
      {resolved === 'classic' ? <ClassicMock tall={tall} /> : null}
      {resolved === 'service' ? <ServiceMock accent={accent} tall={tall} /> : null}
      {resolved === 'modern' ? <ModernMock accent={accent} tall={tall} /> : null}
      {resolved === 'standard' || resolved === 'compact' || resolved === 'plain' ? (
        <ReportMock kind={resolved} tall={tall} />
      ) : null}
      {resolved === '80' || resolved === '58' ? <ReceiptMock width={resolved} tall={tall} /> : null}
      {resolved === 'document' ? <DocumentMock accent={accent} tall={tall} /> : null}
      {resolved === 'trade' ? <TradeMock tall={tall} /> : null}
      {resolved === 'generic' ? <GenericMock tall={tall} /> : null}
    </div>
  )
}

function resolveKind(kind: string): TemplatePreviewKind {
  const known: TemplatePreviewKind[] = [
    'sheet',
    'invoice',
    'classic',
    'service',
    'modern',
    'standard',
    'compact',
    'plain',
    '80',
    '58',
    'document',
    'trade',
  ]
  return (known.includes(kind as TemplatePreviewKind) ? kind : 'generic') as TemplatePreviewKind
}

function SheetMock({ accent, tall }: { accent: string; tall: boolean }) {
  return (
    <div className={cn('relative flex h-full flex-col bg-white', tall ? 'p-4' : 'p-2')}>
      <span className="absolute left-0 top-0" style={{ width: tall ? 56 : 28, height: tall ? 40 : 20, background: '#3DDC97' }} />
      <span className={cn('ml-auto font-semibold', tall ? 'text-sm' : 'text-[9px]')} style={{ color: '#1B3A4B' }}>
        INVOICE
      </span>
      <span className={cn('mt-2 block', tall ? 'h-1' : 'h-0.5')} style={{ background: '#1B3A4B' }} />
      {tall ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <p className="font-semibold">Customer</p>
              <p className="text-slate-500">Acme Trading</p>
            </div>
            <div className="text-right">
              <p>INV-1001</p>
              <p className="text-slate-500">2026-03-01</p>
            </div>
          </div>
          <div className="mt-4 flex-1 space-y-1.5 border-t border-slate-200 pt-3 text-[11px]">
            <div className="flex justify-between font-semibold" style={{ color: accent }}>
              <span>Description</span>
              <span>Amount</span>
            </div>
            <div className="flex justify-between"><span>Goods</span><span>1,000.00</span></div>
            <div className="flex justify-between"><span>Delivery</span><span>50.00</span></div>
          </div>
          <p className="mt-auto text-right text-sm font-bold">Total 1,050.00</p>
        </>
      ) : (
        <>
          <span className="mt-2 h-1.5 w-2/3 rounded bg-slate-200" />
          <span className="mt-1 h-1 w-full rounded bg-slate-100" />
        </>
      )}
    </div>
  )
}

function OfficeMock({ tall }: { tall: boolean }) {
  return (
    <div className={cn('flex h-full flex-col gap-1', tall ? 'p-4' : 'p-2')}>
      <span className={cn('rounded bg-slate-800', tall ? 'h-3 w-24' : 'h-1.5 w-12')} />
      <span className={cn('rounded bg-slate-200', tall ? 'h-2 w-full' : 'h-1 w-full')} />
      <span className={cn('rounded bg-slate-100', tall ? 'h-2 w-4/5' : 'h-1 w-4/5')} />
      {tall ? (
        <div className="mt-3 flex-1 space-y-2 text-[11px]">
          <div className="grid grid-cols-4 gap-1 border-b pb-1 font-semibold">
            <span>Item</span><span>Qty</span><span>Rate</span><span>Amt</span>
          </div>
          <div className="grid grid-cols-4 gap-1"><span>Widget</span><span>2</span><span>100</span><span>200</span></div>
          <div className="grid grid-cols-4 gap-1"><span>Labour</span><span>1</span><span>50</span><span>50</span></div>
        </div>
      ) : (
        <span className="mt-auto grid grid-cols-4 gap-1">
          <span className="h-1 rounded bg-slate-200" />
          <span className="h-1 rounded bg-slate-200" />
          <span className="h-1 rounded bg-slate-200" />
          <span className="h-1 rounded bg-slate-200" />
        </span>
      )}
    </div>
  )
}

function ClassicMock({ tall }: { tall: boolean }) {
  return (
    <div className={cn('flex h-full flex-col gap-1', tall ? 'p-4' : 'p-2')}>
      <span className={cn('w-full rounded bg-slate-200', tall ? 'h-3' : 'h-2')} />
      <span className={cn('w-4/5 rounded bg-slate-100', tall ? 'h-2.5' : 'h-1.5')} />
      {tall ? (
        <table className="mt-3 w-full flex-1 text-left text-[11px]">
          <thead>
            <tr className="border-b"><th>Account</th><th>Debit</th><th>Credit</th></tr>
          </thead>
          <tbody>
            <tr><td>Sales</td><td></td><td>1,000</td></tr>
            <tr><td>Cash</td><td>1,000</td><td></td></tr>
          </tbody>
        </table>
      ) : (
        <span className="mt-auto grid grid-cols-4 gap-1">
          <span className="h-1.5 rounded bg-slate-200" />
          <span className="h-1.5 rounded bg-slate-200" />
          <span className="h-1.5 rounded bg-slate-200" />
          <span className="h-1.5 rounded bg-slate-200" />
        </span>
      )}
    </div>
  )
}

function ServiceMock({ accent, tall }: { accent: string; tall: boolean }) {
  return (
    <div className={cn('flex h-full flex-col gap-1', tall ? 'p-4' : 'p-2')}>
      <span className={cn('rounded', tall ? 'h-3 w-1/2' : 'h-2 w-1/2')} style={{ background: accent }} />
      <span className={cn('w-full rounded bg-slate-100', tall ? 'h-8' : 'h-3')} />
      <span className={cn('w-full rounded bg-slate-100', tall ? 'h-8' : 'h-3')} />
      {tall ? <p className="mt-auto text-right text-xs font-semibold">Hours × rate</p> : null}
    </div>
  )
}

function ModernMock({ accent, tall }: { accent: string; tall: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <span className={cn('text-white', tall ? 'px-4 py-3 text-sm font-semibold' : 'h-4')} style={{ background: accent }}>
        {tall ? 'QUOTATION' : null}
      </span>
      <div className={cn('flex flex-1 flex-col gap-1', tall ? 'p-4' : 'p-2')}>
        <span className={cn('rounded bg-slate-200', tall ? 'h-2.5 w-2/3' : 'h-1.5 w-2/3')} />
        <span className={cn('rounded bg-slate-100', tall ? 'h-2 w-full' : 'h-1.5 w-full')} />
        <span className={cn('rounded bg-slate-100', tall ? 'h-2 w-full' : 'h-1.5 w-full')} />
        {tall ? <p className="mt-auto text-right text-sm font-bold">Brand sheet</p> : null}
      </div>
    </div>
  )
}

function ReportMock({ kind, tall }: { kind: 'standard' | 'compact' | 'plain'; tall: boolean }) {
  const rowH = kind === 'compact' ? (tall ? 18 : 8) : tall ? 24 : 10
  const band = kind === 'plain' ? '#fff' : kind === 'compact' ? '#f1f5f9' : '#e2e8f0'
  return (
    <div className={cn('flex h-full flex-col', tall ? 'p-3' : 'p-1.5')}>
      <span className={cn('mb-1 font-semibold', tall ? 'text-xs' : 'text-[8px]')}>Account</span>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="mb-0.5 flex items-center justify-between rounded px-1 text-[9px]"
          style={{ height: rowH, background: i % 2 ? band : '#fff' }}
        >
          {tall ? (
            <>
              <span>Line {i + 1}</span>
              <span className="tabular">100.00</span>
            </>
          ) : null}
        </span>
      ))}
    </div>
  )
}

function ReceiptMock({ width, tall }: { width: '80' | '58'; tall: boolean }) {
  const w = width === '80' ? (tall ? '11rem' : '4.5rem') : tall ? '8rem' : '3.25rem'
  return (
    <div className="flex h-full items-start justify-center bg-slate-100 py-2">
      <div
        className={cn('space-y-1 bg-white px-2 py-2 font-mono shadow', tall ? 'text-[10px]' : 'text-[7px]')}
        style={{ width: w }}
      >
        <p className="text-center font-bold">SHOP</p>
        <p className="border-b border-dashed border-slate-300 pb-1 text-center">Receipt</p>
        <p className="flex justify-between"><span>Item</span><span>10.00</span></p>
        <p className="flex justify-between"><span>Item</span><span>5.00</span></p>
        <p className="border-t border-dashed border-slate-300 pt-1 text-center font-bold">15.00</p>
        {tall ? <p className="pt-2 text-center text-slate-400">{width} mm</p> : null}
      </div>
    </div>
  )
}

function TradeMock({ tall }: { tall: boolean }) {
  return (
    <div className={cn('flex h-full flex-col bg-white text-slate-800', tall ? 'p-4' : 'p-2')}>
      <p className={cn('font-semibold', tall ? 'text-xs' : 'text-[8px]')}>Company</p>
      <span className={cn('mt-1 border-b border-slate-300', tall ? 'mb-2' : 'mb-1')} />
      <p className={cn('font-semibold', tall ? 'text-sm' : 'text-[9px]')}>Purchase order #PO-1</p>
      <div className={cn('mt-2 grid grid-cols-4 border-b border-slate-400 text-[8px] font-semibold', tall ? 'py-1' : '')}>
        <span className="col-span-2">Description</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Amount</span>
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="grid grid-cols-4 text-[8px]"
          style={{ background: i % 2 ? '#f3f4f6' : '#fff', height: tall ? 16 : 6 }}
        />
      ))}
      <p className={cn('ml-auto mt-auto border-t border-slate-800 pt-1 font-semibold', tall ? 'text-xs' : 'text-[8px]')}>
        Total
      </p>
    </div>
  )
}

function DocumentMock({ accent, tall }: { accent: string; tall: boolean }) {
  return (
    <div className={cn('flex h-full flex-col', tall ? 'p-4' : 'p-2')}>
      <div className={cn('flex items-center justify-between', tall ? 'mb-3' : 'mb-1')}>
        <span
          className={cn('grid place-items-center rounded border border-dashed text-[9px] text-slate-400', tall ? 'size-12' : 'size-6')}
        >
          Logo
        </span>
        <span className={cn('font-bold', tall ? 'text-sm' : 'text-[9px]')} style={{ color: accent }}>
          INVOICE
        </span>
      </div>
      <span className={cn('block rounded', tall ? 'h-2' : 'h-1')} style={{ background: accent }} />
      {tall ? (
        <>
          <div className="mt-3 space-y-1 text-[11px]">
            <p className="font-semibold">Bank lines</p>
            <p className="text-slate-500">Hormud · 615</p>
          </div>
          <div className="mt-4 flex-1 rounded border border-slate-200 p-2 text-[11px]">
            <p className="font-semibold">Line items</p>
            <p className="text-slate-500">Sample goods · 1,000.00</p>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Terms printed under the totals</p>
        </>
      ) : (
        <span className="mt-2 h-1.5 w-3/4 rounded bg-slate-200" />
      )}
    </div>
  )
}

function GenericMock({ tall }: { tall: boolean }) {
  return (
    <div className={cn('flex h-full flex-col gap-1', tall ? 'p-4' : 'p-2')}>
      <span className={cn('rounded bg-slate-200', tall ? 'h-3 w-1/2' : 'h-2 w-1/2')} />
      <span className={cn('rounded bg-slate-100', tall ? 'h-2 w-full' : 'h-1.5 w-full')} />
      <span className={cn('rounded bg-slate-100', tall ? 'h-2 w-4/5' : 'h-1.5 w-4/5')} />
    </div>
  )
}
