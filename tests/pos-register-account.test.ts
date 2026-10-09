import { describe, expect, it } from 'vitest'

import {
  planPosRegisterAccounts,
  POS_BANKS_CODE_START,
  POS_BANKS_DESCRIPTION,
  POS_BANKS_DETAIL,
  POS_BANKS_NAME,
  POS_REGISTER_DETAIL,
  posRegisterAccountDescription,
  type PosRegisterAccountAction,
  type PosRegisterAccountRow,
  type PosRegisterRow,
} from '@/lib/pos-register-account'

function account(partial: Partial<PosRegisterAccountRow> & Pick<PosRegisterAccountRow, 'id' | 'code'>): PosRegisterAccountRow {
  return {
    name: partial.name ?? partial.code,
    description: partial.description ?? null,
    detailType: partial.detailType ?? null,
    parentId: partial.parentId ?? null,
    ...partial,
  }
}

function apply(
  accounts: PosRegisterAccountRow[],
  registers: PosRegisterRow[],
  actions: PosRegisterAccountAction[],
) {
  const nextAccounts = accounts.map((row) => ({ ...row }))
  const nextRegisters = registers.map((row) => ({ ...row }))
  let parent = nextAccounts.find((row) => row.detailType === POS_BANKS_DETAIL)

  for (const action of actions) {
    if (action.type === 'create-parent') {
      parent = account({
        id: `parent-${action.code}`,
        code: action.code,
        name: POS_BANKS_NAME,
        description: POS_BANKS_DESCRIPTION,
        detailType: POS_BANKS_DETAIL,
      })
      nextAccounts.push(parent)
      continue
    }
    if (action.type === 'create-account') {
      const created = account({
        id: `acct-${action.registerId}`,
        code: action.code,
        name: action.name,
        description: action.description,
        detailType: POS_REGISTER_DETAIL,
        parentId: parent?.id ?? null,
      })
      nextAccounts.push(created)
      const register = nextRegisters.find((row) => row.id === action.registerId)
      if (register) register.ledgerAccountId = created.id
      continue
    }
    if (action.type === 'link') {
      const register = nextRegisters.find((row) => row.id === action.registerId)
      if (register) register.ledgerAccountId = action.accountId
      continue
    }
    const row = nextAccounts.find((item) => item.id === action.accountId)
    if (!row) continue
    if (action.type === 'rename') row.name = action.name
    if (action.type === 'retag') row.detailType = POS_REGISTER_DETAIL
    if (action.type === 'attach-parent') row.parentId = parent?.id ?? row.parentId
  }

  return { accounts: nextAccounts, registers: nextRegisters }
}

describe('planPosRegisterAccounts', () => {
  it('creates POS Banks at 1020 and a bank sub-account per register, in name order', () => {
    const actions = planPosRegisterAccounts(
      [account({ id: 'cash', code: '1000', name: 'Cash on Hand' }), account({ id: 'undeposited', code: '1050' })],
      [
        { id: 'reg-b', name: 'B TILL', ledgerAccountId: null },
        { id: 'reg-a', name: 'A TILL', ledgerAccountId: null },
      ],
    )

    expect(actions).toEqual([
      { type: 'create-parent', code: '1020' },
      {
        type: 'create-account',
        registerId: 'reg-a',
        code: '1021',
        name: 'A TILL',
        description: 'POS register reg-a',
      },
      {
        type: 'create-account',
        registerId: 'reg-b',
        code: '1022',
        name: 'B TILL',
        description: 'POS register reg-b',
      },
    ])
    expect(POS_BANKS_CODE_START).toBe(1020)
  })

  it('steps past a taken 1020 so the heading and tills stay grouped', () => {
    const actions = planPosRegisterAccounts(
      [account({ id: 'taken', code: '1020', name: 'Petty cash' })],
      [{ id: 'reg-1', name: 'TILL', ledgerAccountId: null }],
    )
    expect(actions.map((action) => ('code' in action ? action.code : action.type))).toEqual([
      '1021',
      '1022',
    ])
  })

  it('links an existing register account and files it under the heading', () => {
    const actions = planPosRegisterAccounts(
      [
        account({
          id: 'banks',
          code: '1020',
          name: POS_BANKS_NAME,
          detailType: POS_BANKS_DETAIL,
        }),
        account({
          id: 'till-acct',
          code: '1021',
          name: 'Old name',
          description: posRegisterAccountDescription('reg-1'),
          detailType: null,
          parentId: null,
        }),
      ],
      [{ id: 'reg-1', name: 'MOHAMED', ledgerAccountId: null }],
    )

    expect(actions).toEqual([
      { type: 'link', registerId: 'reg-1', accountId: 'till-acct' },
      { type: 'rename', accountId: 'till-acct', name: 'MOHAMED' },
      { type: 'retag', accountId: 'till-acct' },
      { type: 'attach-parent', accountId: 'till-acct' },
    ])
  })

  it('renames a linked register account and does not create another', () => {
    const actions = planPosRegisterAccounts(
      [
        account({ id: 'banks', code: '1020', detailType: POS_BANKS_DETAIL, name: POS_BANKS_NAME }),
        account({
          id: 'till-acct',
          code: '1021',
          name: 'Old name',
          description: posRegisterAccountDescription('reg-1'),
          detailType: POS_REGISTER_DETAIL,
          parentId: 'banks',
        }),
      ],
      [{ id: 'reg-1', name: 'New name', ledgerAccountId: 'till-acct' }],
    )
    expect(actions).toEqual([{ type: 'rename', accountId: 'till-acct', name: 'New name' }])
  })

  it('leaves a register that points at some other account alone', () => {
    const actions = planPosRegisterAccounts(
      [account({ id: 'cash', code: '1000', name: 'Cash on Hand', detailType: 'Cash' })],
      [{ id: 'reg-1', name: 'TILL', ledgerAccountId: 'cash' }],
    )
    expect(actions).toEqual([])
  })

  it('is a no-op once the plan has been applied', () => {
    const registers: PosRegisterRow[] = [
      { id: 'reg-b', name: 'B TILL', ledgerAccountId: null },
      { id: 'reg-a', name: 'A TILL', ledgerAccountId: null },
    ]
    const accounts = [account({ id: 'bank', code: '1010', name: 'Bank Account' })]
    const first = planPosRegisterAccounts(accounts, registers)
    const applied = apply(accounts, registers, first)
    expect(planPosRegisterAccounts(applied.accounts, applied.registers)).toEqual([])
    expect(planPosRegisterAccounts(applied.accounts, applied.registers)).toEqual([])
  })
})
