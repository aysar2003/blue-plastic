import { describe, expect, it } from 'vitest'

import { accountMatchesView, parseAccountView } from './account-views'
import { databaseProblem, databaseProblemText, isNavigationError } from './db-error'
import { parseExpenseKind, signedExpenseAmount } from './expense-kinds'
import { presetRange } from './list-filters'
import { lineLabel } from './purchase-board'

describe('account views', () => {
  const added = { type: 'EXPENSE' as const, isSystem: false, hasChildren: false, parentId: null }
  const systemAsset = { type: 'ASSET' as const, isSystem: true, hasChildren: true, parentId: null }
  const child = { type: 'REVENUE' as const, isSystem: false, hasChildren: false, parentId: 'parent' }

  it('treats system accounts as locked and user accounts as created by you', () => {
    expect(accountMatchesView(added, 'mine')).toBe(true)
    expect(accountMatchesView(added, 'unlocked')).toBe(true)
    expect(accountMatchesView(systemAsset, 'locked')).toBe(true)
    expect(accountMatchesView(systemAsset, 'mine')).toBe(false)
  })

  it('splits the chart into balance sheet, profit and loss, parents, and subaccounts', () => {
    expect(accountMatchesView(systemAsset, 'balance')).toBe(true)
    expect(accountMatchesView(added, 'profit')).toBe(true)
    expect(accountMatchesView(systemAsset, 'parents')).toBe(true)
    expect(accountMatchesView(child, 'children')).toBe(true)
    expect(accountMatchesView(added, 'children')).toBe(false)
    expect(parseAccountView('nope')).toBe('')
  })
})

describe('purchase line labels', () => {
  it('uses an em dash, the single name, or -Split-', () => {
    expect(lineLabel([])).toBe('—')
    expect(lineLabel([null, '  '])).toBe('—')
    expect(lineLabel(['Rent', 'Rent'])).toBe('Rent')
    expect(lineLabel(['Rent', 'Utilities'])).toBe('-Split-')
  })
})

describe('expense register signs', () => {
  it('negates bill payments and supplier credits', () => {
    expect(signedExpenseAmount('BILL', '10').toString()).toBe('10')
    expect(signedExpenseAmount('BILL_PAYMENT', '10').toString()).toBe('-10')
    expect(signedExpenseAmount('VENDOR_CREDIT', '4.5').toString()).toBe('-4.5')
    expect(parseExpenseKind('EXPENSE')).toBe('EXPENSE')
    expect(parseExpenseKind('nope')).toBe('')
  })
})

describe('last 12 months', () => {
  it('runs from the same calendar day a year earlier through today', () => {
    expect(presetRange('last12', '2026-10-05')).toEqual({ from: '2025-10-05', to: '2026-10-05' })
    expect(presetRange('', '2026-10-05')).toBeUndefined()
  })
})

describe('database failures', () => {
  it('classifies Prisma and driver codes without treating a missing person as a missing table', () => {
    expect(databaseProblem({ code: 'P1001' })).toBe('unreachable')
    expect(databaseProblem({ code: 'P1000' })).toBe('authentication')
    expect(databaseProblem({ code: 'P2021' })).toBe('missing-schema')
    expect(databaseProblem(new Error('connect ETIMEDOUT'))).toBe('timeout')
    expect(databaseProblem(new Error('User does not exist'))).toBeNull()
  })

  it('keeps connection strings out of the status text and lets redirects through', () => {
    expect(databaseProblemText('unreachable')).not.toMatch(/postgres:\/\//)
    expect(isNavigationError({ digest: 'NEXT_REDIRECT;replace;/sign-in;307;' })).toBe(true)
    expect(isNavigationError(new Error('database down'))).toBe(false)
  })
})
