import type { AccountType } from '@prisma/client'

/**
 * Shown when a second account cannot take a name that is already on the chart.
 * Merge is the only way two accounts become one; a duplicate name is not.
 */
export const ACCOUNT_NAME_CANNOT_STAND_ALONE =
  'These cannot be merged, and this name cannot be used on its own.'

export type AccountNameParty = {
  id: string
  type: AccountType
  isSystem: boolean
  systemKey: string | null
}

/**
 * A save that would leave two accounts with the same name.
 * Merge when this account can be folded into the one that already has the name.
 * Otherwise refuse — the name must not exist twice.
 */
export function accountNameClashAction(
  self: AccountNameParty | null,
  existing: AccountNameParty,
  mergingIntoDescendant = false,
): 'merge' | 'refuse' {
  if (!self) return 'refuse'
  if (self.type !== existing.type) return 'refuse'
  if (self.isSystem || self.systemKey) return 'refuse'
  if (mergingIntoDescendant) return 'refuse'
  return 'merge'
}
