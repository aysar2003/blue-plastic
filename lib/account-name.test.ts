import { describe, expect, it } from 'vitest'

import { accountNameClashAction, type AccountNameParty } from './account-name'

const ordinary: AccountNameParty = {
  id: 'a',
  type: 'ASSET',
  isSystem: false,
  systemKey: null,
}

const inventory: AccountNameParty = {
  id: 'inv',
  type: 'ASSET',
  isSystem: true,
  systemKey: 'INVENTORY_ASSET',
}

describe('account name clash', () => {
  it('refuses a new account — there is nothing to merge yet', () => {
    expect(accountNameClashAction(null, inventory)).toBe('refuse')
  })

  it('offers to merge an ordinary account into the one that already has the name', () => {
    expect(accountNameClashAction(ordinary, inventory)).toBe('merge')
  })

  it('refuses when the account being saved is a system account', () => {
    expect(accountNameClashAction(inventory, ordinary)).toBe('refuse')
  })

  it('refuses accounts of different types', () => {
    expect(
      accountNameClashAction(ordinary, { ...inventory, type: 'EXPENSE', isSystem: false, systemKey: null }),
    ).toBe('refuse')
  })

  it('refuses folding a parent into its own descendant', () => {
    expect(accountNameClashAction(ordinary, inventory, true)).toBe('refuse')
  })
})
