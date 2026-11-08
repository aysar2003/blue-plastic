import { describe, expect, it } from 'vitest'

import { accountOptions, balanceOf, SUGGESTED_GROUP, type AccountChoice } from './account-options'

const chart: AccountChoice[] = [
  { id: 'bank', code: '1000', name: 'Business current account', type: 'ASSET', subtype: 'BANK', balance: '4200.00' },
  { id: 'petty', code: '1010', name: 'Petty cash', type: 'ASSET', subtype: 'OTHER_CURRENT_ASSET', balance: '150.00' },
  { id: 'ar', code: '1100', name: 'Accounts receivable', type: 'ASSET', subtype: 'ACCOUNTS_RECEIVABLE', balance: '0.00' },
  { id: 'card', code: '2100', name: 'Company card', type: 'LIABILITY', subtype: 'CREDIT_CARD', balance: '-320.00' },
  { id: 'sales', code: '4000', name: 'Sales', type: 'REVENUE', subtype: 'INCOME', balance: '9000.00' },
  { id: 'rent', code: '6100', name: 'Rent', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', balance: '1200.00' },
]

describe('account options', () => {
  it('never drops an account — relevance is ordering, not filtering', () => {
    const options = accountOptions(chart, { prefer: ['BANK', 'CREDIT_CARD'] })

    expect(options).toHaveLength(chart.length)
    expect(options.map((option) => option.id).sort()).toEqual(chart.map((a) => a.id).sort())
  })

  it('puts the preferred subtypes first, in the order asked for', () => {
    const options = accountOptions(chart, { prefer: ['CREDIT_CARD', 'BANK'] })

    expect(options[0].id).toBe('card')
    expect(options[1].id).toBe('bank')
    expect(options[0].group).toBe(SUGGESTED_GROUP)
    expect(options[1].group).toBe(SUGGESTED_GROUP)
  })

  it('groups the rest by statement type in reading order', () => {
    const options = accountOptions(chart, { prefer: ['BANK'] })
    const groups = [...new Set(options.slice(1).map((option) => option.group))]

    expect(groups).toEqual(['Assets', 'Liabilities', 'Income', 'Expenses'])
  })

  it('lifts a whole type when asked, after any preferred subtypes', () => {
    const options = accountOptions(chart, { prefer: ['BANK'], preferTypes: ['EXPENSE'] })

    expect(options[0].id).toBe('bank')
    expect(options[1].id).toBe('rent')
  })

  it('always names the kind of account, and adds the balance when asked', () => {
    const plain = accountOptions(chart, {})
    expect(plain.find((o) => o.id === 'bank')?.hint).toBe('Bank')

    const withBalance = accountOptions(chart, { showBalance: true })
    const bank = withBalance.find((option) => option.id === 'bank')!
    expect(bank.hint).toBe('Bank · 4200.00')
    expect(balanceOf(bank)).toBe('4200.00')
  })

  it('labels an account as code and name, which is how a chart is read', () => {
    const [first] = accountOptions([chart[0]], {})
    expect(first.label).toBe('1000 — Business current account')
  })

  it('shows Main › Sub in the picker when a parent is known', () => {
    const options = accountOptions(
      [
        {
          id: 'branch',
          code: '1046',
          name: 'AL-FURAAT 3 EQ',
          type: 'ASSET',
          subtype: 'BANK',
          parentId: 'main',
          parentName: 'BRANCHIYADA',
        },
      ],
      {},
    )
    expect(options[0].label).toBe('1046 — BRANCHIYADA › AL-FURAAT 3 EQ')
    expect(options[0].hint).toBe('Sub · Bank')
  })

  it('reads no balance out of a hint that carries only the kind', () => {
    expect(balanceOf({ hint: 'Bank' })).toBeNull()
    expect(balanceOf({})).toBeNull()
  })
})
