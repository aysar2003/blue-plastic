'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PrinterIcon, XIcon } from 'lucide-react'

import { formatMoney } from '@/lib/money'
import {
  DEFAULT_RECEIPT_PAPER,
  parseReceiptPaper,
  paymentRows,
  pxToMm,
  RECEIPT_PAPER_KEY,
  RECEIPT_PAPERS,
  trimQty,
  type ReceiptPaper,
  type ReceiptPayment,
} from '@/lib/pos-receipt'

export type ThermalReceiptData = {
  number: string
  isVoid: boolean
  currency: string
  /** ISO timestamp the sale was rung up. */
  createdAt: string
  note: string | null
  subtotal: string
  discount: string
  tax: string
  total: string
  registerName: string | null
  cashierName: string | null
  customer: { name: string; phone: string | null } | null
  lines: {
    id: string
    name: string
    quantity: string
    unitPrice: string
    discountPercent: string | null
    amount: string
  }[]
  payments: ReceiptPayment[]
}

export type ThermalShop = {
  name: string
  addressLines: string[]
  phone: string | null
  taxRegistrationNumber: string | null
  timeZone: string
}

const MONO = 'var(--font-geist-mono), ui-monospace, "Courier New", monospace'

/**
 * A till slip for 80mm (or 58mm) thermal rolls, the kind local shops hand over:
 * black only, monospace, centred header, one continuous page sized to the slip
 * so the printer feeds exactly what it prints. Printed with window.print().
 */
export function ThermalReceipt({
  receipt,
  shop,
  change,
  autoprint,
  creatorBrand,
  initialPaper = DEFAULT_RECEIPT_PAPER,
}: {
  receipt: ThermalReceiptData
  shop: ThermalShop
  /** Cash handed back, known only right after the sale. */
  change: number
  autoprint: boolean
  /** Footer credit when the creator-brand switch is on, otherwise null. */
  creatorBrand: string | null
  initialPaper?: ReceiptPaper
}) {
  const [paper, setPaper] = useState<ReceiptPaper>(initialPaper)
  const [page, setPage] = useState<{ css: string; paper: ReceiptPaper } | null>(null)
  const [paperLoaded, setPaperLoaded] = useState(false)
  const slipRef = useRef<HTMLDivElement>(null)
  const printed = useRef(false)
  const spec = RECEIPT_PAPERS[paper]
  const money = (value: string | number) => formatMoney(value, receipt.currency)
  const pay = paymentRows(receipt.payments, receipt.total, change)
  const hasDiscount = Number(receipt.discount) > 0
  const hasTax = Number(receipt.tax) > 0
  const itemCount = receipt.lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)

  // Remembered per device: the printer on this counter decides the roll.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage only exists after mount */
    setPaper(parseReceiptPaper(window.localStorage.getItem(RECEIPT_PAPER_KEY)))
    setPaperLoaded(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  function choosePaper(next: ReceiptPaper) {
    setPaper(next)
    window.localStorage.setItem(RECEIPT_PAPER_KEY, next)
  }

  // One page exactly as tall as the slip, so nothing breaks onto an A4-style second page.
  useLayoutEffect(() => {
    const slip = slipRef.current
    if (!slip) return
    const measure = () => {
      const heightMm = Math.ceil(pxToMm(slip.getBoundingClientRect().height)) + 2
      setPage({
        paper,
        css: `@page { size: ${spec.widthMm}mm ${heightMm}mm; margin: 0; }
@media print {
  html, body { width: ${spec.widthMm}mm; margin: 0 !important; padding: 0 !important; background: #fff !important; }
}`,
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(slip)
    window.addEventListener('beforeprint', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('beforeprint', measure)
    }
  }, [paper, spec.widthMm])

  useEffect(() => {
    // Wait for the remembered roll width and a page sized for it before printing.
    if (!autoprint || printed.current || !paperLoaded || page?.paper !== paper) return
    printed.current = true
    void document.fonts.ready.then(() => requestAnimationFrame(() => window.print()))
  }, [autoprint, page, paper, paperLoaded])

  function done() {
    if (window.history.length > 1) window.history.back()
    else window.close()
  }

  return (
    <div className="min-h-svh bg-neutral-200 py-6 print:min-h-0 print:bg-white print:p-0">
      <style>{page?.css ?? ''}</style>

      <div className="mx-auto mb-4 flex w-fit flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          <PrinterIcon className="size-4" />
          Print
        </button>
        <div className="inline-flex overflow-hidden rounded-md border border-black/30 bg-white text-sm" role="group" aria-label="Paper width">
          {(['80', '58'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={paper === option}
              onClick={() => choosePaper(option)}
              className={paper === option ? 'bg-black px-3 py-2 font-semibold text-white' : 'px-3 py-2 text-black'}
            >
              {option}mm
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={done}
          className="inline-flex items-center gap-1.5 rounded-md border border-black/30 bg-white px-3 py-2 text-sm text-black"
        >
          <XIcon className="size-4" />
          Done
        </button>
      </div>

      <div
        ref={slipRef}
        data-paper={paper}
        className="thermal-receipt mx-auto bg-white text-black shadow-md print:shadow-none"
        style={{
          width: `${spec.widthMm}mm`,
          padding: `${spec.padMm + 1}mm ${spec.padMm}mm ${spec.padMm + 2}mm`,
          fontFamily: MONO,
          fontSize: `${spec.fontPx}px`,
          lineHeight: 1.35,
          color: '#000',
        }}
      >
        {/* div, not header/footer: the global print sheet hides every header for the app shell. */}
        <div className="text-center">
          <p style={{ fontSize: '1.45em', fontWeight: 800, lineHeight: 1.15, letterSpacing: '0.02em' }}>
            {shop.name.toUpperCase()}
          </p>
          {shop.addressLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {shop.phone ? <p>Tel: {shop.phone}</p> : null}
          {shop.taxRegistrationNumber ? <p>Tax reg: {shop.taxRegistrationNumber}</p> : null}
        </div>

        <Rule />
        <p className="text-center" style={{ fontWeight: 700, letterSpacing: '0.12em' }}>
          SALES RECEIPT
        </p>
        <Row label="Receipt" value={receipt.number} />
        <Row label="Date" value={stamp(receipt.createdAt, shop.timeZone)} />
        {receipt.cashierName ? <Row label="Salesman" value={receipt.cashierName} /> : null}
        {receipt.customer ? <Row label="Customer" value={receipt.customer.name} /> : null}
        {receipt.customer?.phone ? <Row label="Phone" value={receipt.customer.phone} /> : null}
        <Rule />

        <ul>
          {receipt.lines.map((line) => (
            <li key={line.id} style={{ marginBottom: '0.3em', breakInside: 'avoid' }}>
              <p style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{line.name}</p>
              <div className="flex justify-between gap-2">
                <span>
                  {trimQty(line.quantity)} x {money(line.unitPrice)}
                  {line.discountPercent && Number(line.discountPercent) > 0
                    ? ` -${trimQty(line.discountPercent)}%`
                    : ''}
                </span>
                <span className="tabular-nums" style={{ whiteSpace: 'nowrap' }}>
                  {money(line.amount)}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <Rule />

        <Row label={`Items: ${trimQty(String(itemCount))}`} value="" />
        <Row label="Subtotal" value={money(receipt.subtotal)} />
        {hasDiscount ? <Row label="Discount" value={`-${money(receipt.discount)}`} /> : null}
        {hasTax ? <Row label="Tax" value={money(receipt.tax)} /> : null}
        <div className="flex justify-between gap-2" style={{ fontSize: '1.3em', fontWeight: 800, marginTop: '0.2em' }}>
          <span>TOTAL</span>
          <span className="tabular-nums">{money(receipt.total)}</span>
        </div>
        <Rule />

        {pay.rows.map((row, index) => (
          <Row key={`${row.label}-${index}`} label={row.label} value={money(row.amount)} />
        ))}
        <Row label="Paid" value={money(pay.paid)} bold />
        {pay.change > 0 ? <Row label="Change" value={money(pay.change)} bold /> : null}

        {receipt.note ? (
          <>
            <Rule />
            <p style={{ overflowWrap: 'anywhere' }}>{receipt.note}</p>
          </>
        ) : null}

        {receipt.isVoid ? (
          <p className="text-center" style={{ fontSize: '1.4em', fontWeight: 800, letterSpacing: '0.3em', margin: '0.4em 0' }}>
            VOID
          </p>
        ) : null}

        <Rule />
        <div className="text-center">
          <p style={{ fontWeight: 700 }}>Mahadsanid!</p>
          <p>Thank you for shopping with us</p>
          {creatorBrand ? <p style={{ fontSize: '0.8em', marginTop: '0.5em' }}>System: {creatorBrand}</p> : null}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2" style={bold ? { fontWeight: 700 } : undefined}>
      {/* break-word, not anywhere: a label like "Salesman" must never split mid-word on 58mm. */}
      <span style={{ overflowWrap: 'break-word', minWidth: 'fit-content' }}>{label}</span>
      <span className="tabular-nums text-right" style={{ overflowWrap: 'break-word', minWidth: 0 }}>
        {value}
      </span>
    </div>
  )
}

function Rule() {
  return <div aria-hidden style={{ borderTop: '1px dashed #000', margin: '0.45em 0' }} />
}

/** 08/10/2026 17:56, in the shop's own time zone. */
function stamp(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`
}
