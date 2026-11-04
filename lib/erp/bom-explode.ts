import { Decimal, ZERO } from '@/lib/money'

export type BomComponent = {
  id: string
  name: string
  /** Quantity of this component per one parent unit. */
  quantity: Decimal
  children?: BomComponent[]
}

export type ExplodedNeed = {
  id: string
  name: string
  quantity: Decimal
  depth: number
  leaf: boolean
}

/**
 * Multi-level bill of materials. Nested assemblies explode into leaves;
 * a node with no children is a purchased / stocked part.
 */
export function explodeBom(root: BomComponent, buildQty: Decimal): ExplodedNeed[] {
  const qty = new Decimal(buildQty)
  if (qty.lessThanOrEqualTo(0)) return []
  const acc = new Map<string, ExplodedNeed>()

  function walk(node: BomComponent, factor: Decimal, depth: number) {
    const needed = node.quantity.times(factor)
    const kids = node.children?.filter((child) => child.id !== node.id) ?? []
    const leaf = kids.length === 0
    const prior = acc.get(node.id)
    if (prior) {
      prior.quantity = prior.quantity.plus(needed)
      if (depth < prior.depth) prior.depth = depth
      prior.leaf = prior.leaf && leaf
    } else {
      acc.set(node.id, {
        id: node.id,
        name: node.name,
        quantity: needed,
        depth,
        leaf,
      })
    }
    for (const child of kids) walk(child, needed, depth + 1)
  }

  for (const child of root.children ?? []) walk(child, qty, 0)
  return [...acc.values()].sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name))
}

export function leafNeeds(rows: ExplodedNeed[]): ExplodedNeed[] {
  return rows.filter((row) => row.leaf)
}

export function shortage(
  needed: Decimal,
  onHand: Decimal,
): Decimal {
  const gap = needed.minus(onHand)
  return gap.greaterThan(0) ? gap : ZERO
}
