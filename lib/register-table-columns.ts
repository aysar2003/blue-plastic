/** Fixed register columns (split account columns use `split:${code}`). */
export const REGISTER_FIXED_COLUMN_IDS = [
  'date',
  'entry',
  'type',
  'name',
  'description',
  'document',
  'contra',
  'debit',
  'credit',
  'balance',
] as const

export type RegisterFixedColumnId = (typeof REGISTER_FIXED_COLUMN_IDS)[number]

export type RegisterColumnId = RegisterFixedColumnId | `split:${string}`

export type RegisterColumnDef = {
  id: RegisterColumnId
  label: string
  /** Split columns show amounts; most fixed columns are text. */
  kind: 'text' | 'money' | 'split'
}

export const REGISTER_COLUMN_LABELS: Record<RegisterFixedColumnId, string> = {
  date: 'Date',
  entry: 'Entry',
  type: 'Type',
  name: 'Name',
  description: 'Description',
  document: 'Document',
  contra: 'Contra account',
  debit: 'Debit',
  credit: 'Credit',
  balance: 'Balance',
}

export type RegisterColumnPrefs = {
  order: RegisterColumnId[]
  hidden: RegisterColumnId[]
}

export function storageKeyForRegister(accountId: string) {
  return `bp-register-columns-v1-${accountId}`
}

export function splitColumnId(code: string): RegisterColumnId {
  return `split:${code}`
}

export function isSplitColumnId(id: RegisterColumnId): id is `split:${string}` {
  return id.startsWith('split:')
}

/** Build the full column list for this result set, with splits after Document. */
export function buildRegisterColumns(
  splits: { code: string; name: string }[],
): RegisterColumnDef[] {
  const before = REGISTER_FIXED_COLUMN_IDS.slice(0, 7).map((id) => ({
    id,
    label: REGISTER_COLUMN_LABELS[id],
    kind: 'text' as const,
  }))
  const splitCols: RegisterColumnDef[] = splits.map((s) => ({
    id: splitColumnId(s.code),
    label: s.name,
    kind: 'split',
  }))
  const after = REGISTER_FIXED_COLUMN_IDS.slice(7).map((id) => ({
    id,
    label: REGISTER_COLUMN_LABELS[id],
    kind: id === 'debit' || id === 'credit' || id === 'balance' ? ('money' as const) : ('text' as const),
  }))
  return [...before, ...splitCols, ...after]
}

export function defaultRegisterPrefs(allIds: RegisterColumnId[]): RegisterColumnPrefs {
  return {
    order: [...allIds],
    hidden: ['contra'],
  }
}

export function mergeRegisterPrefs(
  saved: RegisterColumnPrefs | null,
  allIds: RegisterColumnId[],
): RegisterColumnPrefs {
  const valid = new Set(allIds)
  const base = saved ?? defaultRegisterPrefs(allIds)
  const order = [
    ...base.order.filter((id) => valid.has(id)),
    ...allIds.filter((id) => !base.order.includes(id)),
  ]
  const hidden = base.hidden.filter((id) => valid.has(id))
  return { order, hidden }
}

export function visibleRegisterColumns(
  catalog: RegisterColumnDef[],
  prefs: RegisterColumnPrefs,
): RegisterColumnDef[] {
  const byId = new Map(catalog.map((c) => [c.id, c]))
  return prefs.order
    .filter((id) => !prefs.hidden.includes(id))
    .map((id) => byId.get(id))
    .filter((c): c is RegisterColumnDef => Boolean(c))
}
