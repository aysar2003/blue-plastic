/**
 * P5 vertical helpers — NGO / services / construction / mfg / distribution.
 * Pure math (no I/O).
 */

export function clampPercent(value: string | number | null | undefined): number {
  const n = typeof value === 'string' ? Number(value) : Number(value ?? 0)
  if (!Number.isFinite(n) || n <= 0) return 0
  if (n >= 100) return 100
  return Math.round(n * 10000) / 10000
}

/** Progress bill: new % minus already billed %, applied to contract value. */
export function progressBillGross(input: {
  contractValue: string | number
  alreadyBilledPercent: string | number
  thisBillPercent: string | number
}): { ok: true; gross: string; deltaPercent: number } | { ok: false; message: string } {
  const contract = Number(input.contractValue)
  if (!Number.isFinite(contract) || contract <= 0) {
    return { ok: false, message: 'Contract value must be greater than zero.' }
  }
  const already = clampPercent(input.alreadyBilledPercent)
  const target = clampPercent(input.thisBillPercent)
  if (target <= already) {
    return { ok: false, message: 'Progress % must be higher than what is already billed.' }
  }
  const delta = target - already
  const gross = ((contract * delta) / 100).toFixed(4)
  return { ok: true, gross, deltaPercent: delta }
}

/** Retention held from a progress bill. */
export function retentionHeld(gross: string | number, retentionPercent: string | number): string {
  const g = Number(gross)
  const pct = clampPercent(retentionPercent)
  if (!Number.isFinite(g) || g <= 0 || pct <= 0) return '0.0000'
  return ((g * pct) / 100).toFixed(4)
}

/** Net billable after retention. */
export function progressBillNet(gross: string | number, retentionPercent: string | number): string {
  const g = Number(gross)
  const held = Number(retentionHeld(gross, retentionPercent))
  if (!Number.isFinite(g)) return '0.0000'
  return (g - held).toFixed(4)
}

/** Unbilled WIP value from time entries. */
export function wipFromEntries(
  entries: { hours: string | number; billableRate: string | number | null; billable: boolean; invoicedAt?: string | null }[],
): { hours: string; amount: string; entryCount: number } {
  let hours = 0
  let amount = 0
  let entryCount = 0
  for (const entry of entries) {
    if (!entry.billable || entry.invoicedAt) continue
    const h = Number(entry.hours)
    const rate = Number(entry.billableRate ?? 0)
    if (!Number.isFinite(h) || h <= 0) continue
    hours += h
    amount += h * (Number.isFinite(rate) ? rate : 0)
    entryCount += 1
  }
  return { hours: hours.toFixed(4), amount: amount.toFixed(4), entryCount }
}

/** Utilization % = billable hours / available hours. */
export function utilizationPercent(billableHours: string | number, availableHours: string | number): number {
  const billable = Number(billableHours)
  const available = Number(availableHours)
  if (!Number.isFinite(billable) || !Number.isFinite(available) || available <= 0) return 0
  return Math.round((billable / available) * 1000) / 10
}

/** Budget vs actual variance (positive = under budget). */
export function budgetVariance(budgeted: string | number, actual: string | number): string {
  const b = Number(budgeted)
  const a = Number(actual)
  if (!Number.isFinite(b) || !Number.isFinite(a)) return '0.0000'
  return (b - a).toFixed(4)
}

/** Routing capacity: total planned minutes. */
export function routingMinutes(steps: { minutes: string | number }[]): string {
  let total = 0
  for (const step of steps) {
    const m = Number(step.minutes)
    if (Number.isFinite(m) && m > 0) total += m
  }
  return total.toFixed(4)
}

/** WO demand minutes vs weekly capacity → load %. */
export function capacityLoadPercent(
  demandMinutes: string | number,
  capacityMinutes: string | number,
): number {
  const demand = Number(demandMinutes)
  const capacity = Number(capacityMinutes)
  if (!Number.isFinite(demand) || demand < 0) return 0
  if (!Number.isFinite(capacity) || capacity <= 0) return demand > 0 ? 999 : 0
  return Math.round((demand / capacity) * 1000) / 10
}

export function canReceiveAsn(status: 'EXPECTED' | 'RECEIVED' | 'CANCELLED'): boolean {
  return status === 'EXPECTED'
}

/**
 * Match ASN lines onto open PO lines by itemId (FIFO on remaining qty).
 * Returns receive rows or a variance message when ASN exceeds remaining.
 */
export function matchAsnToPoLines(input: {
  asnLines: { itemId: string | null; quantity: string | number }[]
  poLines: {
    lineId: string
    itemId: string | null
    ordered: string | number
    received: string | number
  }[]
}):
  | { ok: true; lines: { lineId: string; quantity: string }[] }
  | { ok: false; message: string } {
  const remaining = new Map<string, { lineId: string; left: number }[]>()
  for (const line of input.poLines) {
    if (!line.itemId) continue
    const left = Number(line.ordered) - Number(line.received)
    if (!Number.isFinite(left) || left <= 0) continue
    const bucket = remaining.get(line.itemId) ?? []
    bucket.push({ lineId: line.lineId, left })
    remaining.set(line.itemId, bucket)
  }

  const out: { lineId: string; quantity: string }[] = []
  for (const asn of input.asnLines) {
    if (!asn.itemId) {
      return { ok: false, message: 'Every ASN line needs an item to receive against a PO.' }
    }
    let need = Number(asn.quantity)
    if (!Number.isFinite(need) || need <= 0) {
      return { ok: false, message: 'ASN quantities must be more than zero.' }
    }
    const bucket = remaining.get(asn.itemId) ?? []
    while (need > 0.00005) {
      const next = bucket.find((row) => row.left > 0)
      if (!next) {
        return {
          ok: false,
          message: `ASN quantity exceeds what is still open on the purchase order for that item.`,
        }
      }
      const take = Math.min(need, next.left)
      out.push({ lineId: next.lineId, quantity: take.toFixed(4) })
      next.left -= take
      need -= take
    }
  }
  if (out.length === 0) {
    return { ok: false, message: 'Nothing to receive from this ASN.' }
  }
  return { ok: true, lines: out }
}

export function canReceivePledge(status: 'PLEDGED' | 'RECEIVED' | 'CANCELLED'): boolean {
  return status === 'PLEDGED'
}
