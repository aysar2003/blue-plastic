import 'server-only'

import { Prisma } from '@prisma/client'

import type { Tx } from '@/server/db'

/**
 * Allow ledger integrity triggers to let an organisation CASCADE-delete through
 * posted journals, system accounts, and stock movements. Local to the current
 * transaction only (`set_config` third arg = true).
 */
export async function allowCompanyWipe(tx: Tx): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.allow_company_wipe', 'on', true)`
}

type FkEdge = {
  from: string
  to: string
  cols: string[]
  nullableCols: string[]
  onDelete: string
}

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/

function quoteIdent(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Unexpected table or column name: ${name}`)
  return `"${name}"`
}

/**
 * Remove every book that belongs to an organisation so the organisation row
 * itself can be deleted.
 *
 * Child tables reference each other with ON DELETE RESTRICT (a journal line
 * cannot outlive its account, a posted journal cannot be edited). CASCADE from
 * the organisation row therefore dies on the first sibling it tries to remove.
 * Some of those children have no `orgId` (till payments, register staff). Some
 * foreign keys are composite and were previously skipped. Nullable edges that
 * form a cycle — a fiscal year pointing at its closing journal, which points at
 * a period of that year — are cleared first. The rest are deleted leaves-first.
 */
export async function wipeCompanyBooks(tx: Tx, orgId: string): Promise<void> {
  await allowCompanyWipe(tx)

  const orgIdTables = new Set(
    (
      await tx.$queryRaw<{ relname: string }[]>`
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'orgId' AND NOT a.attisdropped
        WHERE n.nspname = 'public' AND c.relkind = 'r'
      `
    ).map((row) => row.relname),
  )

  const edges = await tx.$queryRaw<
    { from: string; to: string; cols: string[]; nullableCols: string[] | null; onDelete: string }[]
  >`
    SELECT rel.relname::text AS "from",
           frel.relname::text AS "to",
           c.confdeltype::text AS "onDelete",
           array_agg(att.attname::text ORDER BY x.ord)::text[] AS cols,
           COALESCE(
             array_agg(att.attname::text ORDER BY x.ord)
               FILTER (WHERE col.is_nullable = 'YES'),
             ARRAY[]::text[]
           )::text[] AS "nullableCols"
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_class frel ON frel.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    JOIN unnest(c.conkey) WITH ORDINALITY AS x(attnum, ord) ON true
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = x.attnum
    JOIN information_schema.columns col
      ON col.table_schema = 'public'
     AND col.table_name = rel.relname
     AND col.column_name = att.attname
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
    GROUP BY c.oid, rel.relname, frel.relname, c.confdeltype
  `

  const fks: FkEdge[] = edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    cols: edge.cols,
    nullableCols: edge.nullableCols ?? [],
    onDelete: edge.onDelete,
  }))

  const cascadeChildren = new Map<string, { child: string; col: string }[]>()
  for (const edge of fks) {
    if (edge.onDelete !== 'c') continue
    const list = cascadeChildren.get(edge.to) ?? []
    list.push({ child: edge.from, col: edge.cols[0]! })
    cascadeChildren.set(edge.to, list)
  }

  const closure = new Set<string>()
  const stack = ['organizations']
  while (stack.length > 0) {
    const parent = stack.pop()!
    for (const hop of cascadeChildren.get(parent) ?? []) {
      if (hop.child === 'organizations' || closure.has(hop.child)) continue
      closure.add(hop.child)
      stack.push(hop.child)
    }
  }

  const via = new Map<string, { col: string; parent: string }>()
  for (const table of closure) {
    if (orgIdTables.has(table)) continue
    let found: { col: string; parent: string } | undefined
    for (const parent of ['organizations', ...closure]) {
      const kid = (cascadeChildren.get(parent) ?? []).find((row) => row.child === table)
      if (!kid) continue
      const candidate = { col: kid.col, parent }
      if (!found || orgIdTables.has(parent) || parent === 'organizations') {
        found = candidate
        if (orgIdTables.has(parent) || parent === 'organizations') break
      }
    }
    if (!found) {
      throw new Error(`Cannot wipe company: ${table} has no organisation-scoped parent.`)
    }
    via.set(table, found)
  }

  const relevant = fks.filter(
    (edge) =>
      closure.has(edge.from) &&
      closure.has(edge.to) &&
      (edge.onDelete === 'c' || edge.onDelete === 'r' || edge.onDelete === 'a'),
  )

  const breakable: FkEdge[] = []
  let active = relevant.filter((edge) => {
    if (edge.from === edge.to) {
      if (edge.nullableCols.length === 0) {
        throw new Error(
          `Cannot wipe company: ${edge.from}.${edge.cols.join(',')} is a required self-reference.`,
        )
      }
      breakable.push(edge)
      return false
    }
    return true
  })

  for (;;) {
    const cycle = findCycleEdge(active)
    if (!cycle) break
    if (cycle.nullableCols.length === 0) {
      throw new Error(
        `Cannot wipe company: ${cycle.from}.${cycle.cols.join(',')} → ${cycle.to} is part of a required foreign-key cycle.`,
      )
    }
    breakable.push(cycle)
    active = active.filter((edge) => edge !== cycle)
  }

  const scope = (table: string): Prisma.Sql => {
    if (table === 'organizations') return Prisma.sql`id = ${orgId}`
    if (orgIdTables.has(table)) return Prisma.sql`"orgId" = ${orgId}`
    const hop = via.get(table)
    if (!hop) throw new Error(`Cannot wipe company: ${table} is not organisation-scoped.`)
    return Prisma.sql`${Prisma.raw(quoteIdent(hop.col))} IN (SELECT id FROM ${Prisma.raw(quoteIdent(hop.parent))} WHERE ${scope(hop.parent)})`
  }

  for (const edge of breakable) {
    const assignments = edge.nullableCols.map((col) => `${quoteIdent(col)} = NULL`).join(', ')
    await tx.$executeRaw(
      Prisma.sql`UPDATE ${Prisma.raw(quoteIdent(edge.from))} SET ${Prisma.raw(assignments)} WHERE ${scope(edge.from)}`,
    )
  }

  const ordered = deletionOrder(active, closure)
  if (ordered.length !== closure.size) {
    const missing = [...closure].filter((table) => !ordered.includes(table))
    throw new Error(`Cannot wipe company: leftover tables ${missing.join(', ')}.`)
  }

  for (const table of ordered) {
    await tx.$executeRaw(
      Prisma.sql`DELETE FROM ${Prisma.raw(quoteIdent(table))} WHERE ${scope(table)}`,
    )
  }
}

/** An edge on a cycle, preferring a nullable one so the cycle can be broken. */
function findCycleEdge(edges: FkEdge[]): FkEdge | null {
  const nodes = new Set<string>()
  for (const edge of edges) {
    nodes.add(edge.from)
    nodes.add(edge.to)
  }
  const sccs = stronglyConnected([...nodes], edges)
  for (const scc of sccs) {
    if (scc.length === 1) {
      const self = edges.find((edge) => edge.from === scc[0] && edge.to === scc[0])
      if (self) return self
      continue
    }
    const members = new Set(scc)
    const inner = edges.filter((edge) => members.has(edge.from) && members.has(edge.to))
    const nullable = inner.find((edge) => edge.nullableCols.length > 0)
    if (nullable) return nullable
    if (inner[0]) return inner[0]
  }
  return null
}

function stronglyConnected(nodes: string[], edges: FkEdge[]): string[][] {
  const outgoing = new Map<string, string[]>()
  for (const node of nodes) outgoing.set(node, [])
  for (const edge of edges) outgoing.get(edge.from)?.push(edge.to)

  let index = 0
  const stack: string[] = []
  const onStack = new Set<string>()
  const indices = new Map<string, number>()
  const lowlink = new Map<string, number>()
  const components: string[][] = []

  const visit = (node: string) => {
    indices.set(node, index)
    lowlink.set(node, index)
    index += 1
    stack.push(node)
    onStack.add(node)

    for (const next of outgoing.get(node) ?? []) {
      if (!indices.has(next)) {
        visit(next)
        lowlink.set(node, Math.min(lowlink.get(node)!, lowlink.get(next)!))
      } else if (onStack.has(next)) {
        lowlink.set(node, Math.min(lowlink.get(node)!, indices.get(next)!))
      }
    }

    if (lowlink.get(node) === indices.get(node)) {
      const scc: string[] = []
      for (;;) {
        const taken = stack.pop()!
        onStack.delete(taken)
        scc.push(taken)
        if (taken === node) break
      }
      components.push(scc)
    }
  }

  for (const node of nodes) {
    if (!indices.has(node)) visit(node)
  }
  return components
}

/** Referencing tables first, then the tables they point at. */
function deletionOrder(edges: FkEdge[], tables: Set<string>): string[] {
  const indegree = new Map<string, number>()
  const after = new Map<string, string[]>()
  for (const table of tables) indegree.set(table, 0)
  for (const edge of edges) {
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
    const list = after.get(edge.from) ?? []
    list.push(edge.to)
    after.set(edge.from, list)
  }

  const ready = [...tables].filter((table) => (indegree.get(table) ?? 0) === 0).sort()
  const ordered: string[] = []
  while (ready.length > 0) {
    const table = ready.shift()!
    ordered.push(table)
    for (const next of after.get(table) ?? []) {
      const left = (indegree.get(next) ?? 1) - 1
      indegree.set(next, left)
      if (left === 0) ready.push(next)
    }
    ready.sort()
  }
  return ordered
}
