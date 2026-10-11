import type { AccountSubtype, AccountType } from '@prisma/client'

import { ACCOUNT_SUBTYPE_ORDER, ACCOUNT_TYPE_ORDER } from '@/lib/accounting-labels'

/** Indent for each nested level — rem so it scales with the UI, not the page width. */
export const CHART_SUB_INDENT = '1.25rem'

/** Inline style for the name / code cells of a nested row. */
export function chartSubIndentStyle(depth: number): { paddingLeft: string } | undefined {
  if (depth <= 0) return undefined
  return { paddingLeft: `calc(${CHART_SUB_INDENT} * ${depth})` }
}

export function chartSubIndentPadStyle(depth: number): { paddingLeft: string } | undefined {
  return chartSubIndentStyle(depth)
}

/**
 * QuickBooks-style names (`Parent:Child`) often arrive without parentId.
 * Point each orphan at the longest matching parent name of the same type so
 * the chart and statements can nest them under the main account.
 */
export function linkColonParents<
  T extends { id: string; name: string; type: AccountType; parentId: string | null },
>(accounts: T[]): T[] {
  const byName = new Map<string, T>()
  for (const account of accounts) {
    if (!byName.has(account.name)) byName.set(account.name, account)
  }

  return accounts.map((account) => {
    if (account.parentId) return account
    const parent = colonParentOf(account.name, account.type, byName, account.id)
    return parent ? { ...account, parentId: parent.id } : account
  })
}

function colonParentOf<T extends { id: string; name: string; type: AccountType }>(
  name: string,
  type: AccountType,
  byName: Map<string, T>,
  selfId: string,
): T | null {
  let idx = name.lastIndexOf(':')
  while (idx > 0) {
    const parentName = name.slice(0, idx).trim()
    const parent = byName.get(parentName)
    if (parent && parent.id !== selfId && parent.type === type) return parent
    idx = name.lastIndexOf(':', idx - 1)
  }
  return null
}

/** Drop the `Parent:` prefix once the row already sits under that parent. */
export function childDisplayName(name: string, parentName: string | null | undefined): string {
  if (!parentName) return name
  const prefix = `${parentName}:`
  if (name.startsWith(prefix)) {
    const rest = name.slice(prefix.length).trim()
    return rest || name
  }
  return name
}

/**
 * When a filter keeps a sub-account, also keep its parents (and children of
 * matched headings) so the tree never drops a child while its parent is gone.
 */
export function keepChartFamily<T extends { id: string; parentId: string | null }>(
  all: T[],
  matched: T[],
): T[] {
  if (matched.length === 0) return []
  if (matched.length === all.length) return matched

  const byId = new Map(all.map((account) => [account.id, account]))
  const children = new Map<string, T[]>()
  for (const account of all) {
    if (!account.parentId) continue
    const list = children.get(account.parentId) ?? []
    list.push(account)
    children.set(account.parentId, list)
  }

  const keep = new Set(matched.map((account) => account.id))

  for (const account of matched) {
    let parentId = account.parentId
    while (parentId) {
      if (keep.has(parentId)) break
      const parent = byId.get(parentId)
      if (!parent) break
      keep.add(parent.id)
      parentId = parent.parentId
    }
  }

  const queue = [...matched.map((account) => account.id)]
  while (queue.length > 0) {
    const id = queue.pop()!
    for (const child of children.get(id) ?? []) {
      if (keep.has(child.id)) continue
      keep.add(child.id)
      queue.push(child.id)
    }
  }

  return all.filter((account) => keep.has(account.id))
}

type Nestable = {
  id: string
  parentId: string | null
  code: string
  type: AccountType
  subtype?: AccountSubtype | null
}

/**
 * Keep every sub-account directly under its parent (DFS).
 * Default order: statement type → detail type (Bank with Bank, …) → code,
 * so the same kinds sit together and children stay under their main.
 */
export function nestChartRows<T extends Nestable>(accounts: T[]): Array<T & { treeDepth: number }> {
  const ids = new Set(accounts.map((account) => account.id))
  const byParent = new Map<string | null, T[]>()
  for (const account of accounts) {
    const key = account.parentId && ids.has(account.parentId) ? account.parentId : null
    const list = byParent.get(key) ?? []
    list.push(account)
    byParent.set(key, list)
  }

  const typeRank = new Map(ACCOUNT_TYPE_ORDER.map((type, index) => [type, index]))
  const subtypeRank = new Map(ACCOUNT_SUBTYPE_ORDER.map((subtype, index) => [subtype, index]))
  const byKind = (a: Nestable, b: Nestable) =>
    (typeRank.get(a.type) ?? 99) - (typeRank.get(b.type) ?? 99) ||
    (subtypeRank.get(a.subtype ?? ('' as AccountSubtype)) ?? 99) -
      (subtypeRank.get(b.subtype ?? ('' as AccountSubtype)) ?? 99) ||
    a.code.localeCompare(b.code)

  for (const list of byParent.values()) {
    list.sort(byKind)
  }

  const roots = [...(byParent.get(null) ?? [])]
  roots.sort(byKind)

  const ordered: Array<T & { treeDepth: number }> = []
  function walk(nodes: T[], depth: number) {
    for (const node of nodes) {
      ordered.push({ ...node, treeDepth: depth })
      walk(byParent.get(node.id) ?? [], depth + 1)
    }
  }
  walk(roots, 0)
  return ordered
}
