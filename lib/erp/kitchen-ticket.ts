/**
 * Hospitality ticket states for a kitchen display. Staff bump on a screen.
 * Not an IoT printer, not a health-code device, not a certified restaurant POS.
 */

export const KITCHEN_STATUSES = ['OPEN', 'FIRED', 'READY', 'DONE'] as const
export type KitchenStatus = (typeof KITCHEN_STATUSES)[number]

export const KITCHEN_LEGAL =
  'Kitchen display for this company’s tills. Tickets are booked in SOM ERP — no hardware control.'

const NEXT: Record<KitchenStatus, KitchenStatus | null> = {
  OPEN: 'FIRED',
  FIRED: 'READY',
  READY: 'DONE',
  DONE: null,
}

export function isKitchenStatus(value: string): value is KitchenStatus {
  return (KITCHEN_STATUSES as readonly string[]).includes(value)
}

export function nextKitchenStatus(status: KitchenStatus): KitchenStatus | null {
  return NEXT[status]
}

export function canBumpKitchen(from: KitchenStatus, to: KitchenStatus): boolean {
  return NEXT[from] === to
}

export type KitchenLine = { name: string; qty: string }

export function parseKitchenLines(raw: unknown): KitchenLine[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const data = row as Record<string, unknown>
      const name = String(data.name ?? '').trim()
      const qty = String(data.qty ?? '1').trim() || '1'
      if (!name) return null
      return { name, qty }
    })
    .filter((row): row is KitchenLine => Boolean(row))
}
