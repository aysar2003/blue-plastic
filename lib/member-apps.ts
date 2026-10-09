import { PERMISSION_GROUPS } from '@/lib/permissions-catalog'
import type { Permission } from '@/lib/permissions-catalog'

/**
 * Which home-screen apps a permission set unlocks.
 * An app is “open” when the member has at least one permission in that group
 * (usually the `:read` that the launcher checks).
 */
export function appsOpenFor(permissions: ReadonlySet<string> | Iterable<string>): {
  id: string
  label: string
}[] {
  const set = permissions instanceof Set ? permissions : new Set(permissions)
  return PERMISSION_GROUPS.filter((group) =>
    group.permissions.some((p) => set.has(p.key)),
  ).map((group) => ({ id: group.id, label: group.label }))
}

/** Gate permission used by the launcher for each app group (first `:read` or first key). */
export function appGatePermission(groupId: string): Permission | null {
  const group = PERMISSION_GROUPS.find((g) => g.id === groupId)
  if (!group?.permissions.length) return null
  const read = group.permissions.find((p) => p.key.endsWith(':read'))
  return (read ?? group.permissions[0]!).key
}
