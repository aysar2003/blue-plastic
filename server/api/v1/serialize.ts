import { Decimal } from '@/lib/money'

/** JSON-safe snapshot of service results (Decimal → string, Date → ISO). */
export function serializeForApi(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Decimal) return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(serializeForApi)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeForApi(v)
    }
    return out
  }
  if (typeof value === 'bigint') return value.toString()
  return value
}
