import { Decimal, ZERO } from '@/lib/money'

export type AsnDockSlot = {
  id: string
  number: string
  vendorName: string
  dockName: string | null
  dockAt: Date | string | null
  expectedAt: Date | string | null
  status: string
}

export type DockCalendarDay = {
  date: string
  slots: {
    id: string
    number: string
    vendorName: string
    dockName: string
    time: string | null
    status: string
  }[]
}

function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const datePart = value.slice(0, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null
  }
  if (Number.isNaN(value.getTime())) return null
  return value.toISOString().slice(0, 10)
}

function isoTime(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(11, 16)
}

/** Group expected dock appointments by calendar day (dockAt, else expectedAt). */
export function groupAsnByDockDay(rows: AsnDockSlot[]): DockCalendarDay[] {
  const byDay = new Map<string, DockCalendarDay['slots']>()
  for (const row of rows) {
    const date = isoDate(row.dockAt) ?? isoDate(row.expectedAt)
    if (!date) continue
    const list = byDay.get(date) ?? []
    list.push({
      id: row.id,
      number: row.number,
      vendorName: row.vendorName,
      dockName: row.dockName?.trim() || 'Unassigned dock',
      time: isoTime(row.dockAt),
      status: row.status,
    })
    byDay.set(date, list)
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, slots]) => ({
      date,
      slots: slots.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.number.localeCompare(b.number)),
    }))
}

export type AsnPoDiscrepancyRow = {
  itemId: string
  itemName: string
  asnQty: string
  poOrdered: string
  poReceived: string
  poOpen: string
  variance: string
  kind: 'short' | 'over' | 'match' | 'asn_only' | 'po_only'
}

/** ASN qty vs PO ordered/open by item — over, short, or unmatched. */
export function asnPoDiscrepancy(input: {
  asnLines: { itemId: string | null; quantity: string | number; itemName?: string | null }[]
  poLines: {
    itemId: string | null
    ordered: string | number
    received: string | number
    itemName?: string | null
  }[]
}): AsnPoDiscrepancyRow[] {
  const asnByItem = new Map<string, { qty: Decimal; name: string }>()
  for (const line of input.asnLines) {
    if (!line.itemId) continue
    const prior = asnByItem.get(line.itemId) ?? { qty: ZERO, name: line.itemName?.trim() || line.itemId }
    asnByItem.set(line.itemId, {
      qty: prior.qty.plus(line.quantity),
      name: line.itemName?.trim() || prior.name,
    })
  }

  const poByItem = new Map<string, { ordered: Decimal; received: Decimal; name: string }>()
  for (const line of input.poLines) {
    if (!line.itemId) continue
    const prior = poByItem.get(line.itemId) ?? {
      ordered: ZERO,
      received: ZERO,
      name: line.itemName?.trim() || line.itemId,
    }
    poByItem.set(line.itemId, {
      ordered: prior.ordered.plus(line.ordered),
      received: prior.received.plus(line.received),
      name: line.itemName?.trim() || prior.name,
    })
  }

  const keys = new Set([...asnByItem.keys(), ...poByItem.keys()])
  const rows: AsnPoDiscrepancyRow[] = []
  for (const itemId of keys) {
    const asn = asnByItem.get(itemId)
    const po = poByItem.get(itemId)
    const asnQty = asn?.qty ?? ZERO
    const ordered = po?.ordered ?? ZERO
    const received = po?.received ?? ZERO
    const open = Decimal.max(ordered.minus(received), ZERO)
    const variance = asnQty.minus(open)
    let kind: AsnPoDiscrepancyRow['kind'] = 'match'
    if (!asn) kind = 'po_only'
    else if (!po) kind = 'asn_only'
    else if (variance.greaterThan(0.00005)) kind = 'over'
    else if (variance.lessThan(-0.00005)) kind = 'short'
    rows.push({
      itemId,
      itemName: asn?.name ?? po?.name ?? itemId,
      asnQty: asnQty.toFixed(4),
      poOrdered: ordered.toFixed(4),
      poReceived: received.toFixed(4),
      poOpen: open.toFixed(4),
      variance: variance.toFixed(4),
      kind,
    })
  }
  return rows.sort((a, b) => a.itemName.localeCompare(b.itemName))
}

export function asnDiscrepancyCsvRows(rows: AsnPoDiscrepancyRow[]) {
  return rows.map((row) => [
    row.itemName,
    row.asnQty,
    row.poOrdered,
    row.poReceived,
    row.poOpen,
    row.variance,
    row.kind,
  ])
}
