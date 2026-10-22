import { describe, expect, it } from 'vitest'

import { toApprovalTrailCycles } from '@/lib/approval-trail'

const at = new Date('2026-10-21T09:00:00.000Z')

describe('toApprovalTrailCycles', () => {
  it('lists assigned people still waiting when the paper is pending', () => {
    const [cycle] = toApprovalTrailCycles([
      {
        id: 'r1',
        status: 'PENDING',
        submittedAt: at,
        decidedAt: null,
        currentLevel: 1,
        requiredLevels: 1,
        submittedBy: { name: 'Staff' },
        policy: {
          approvers: [
            { userId: 'a', user: { name: 'Accountant' } },
            { userId: 'b', user: { name: 'Owner' } },
          ],
        },
        decisions: [],
      },
    ])
    expect(cycle.waitingAnyone).toBe(false)
    expect(cycle.waitingFor).toEqual(['Accountant', 'Owner'])
    expect(cycle.submittedBy).toBe('Staff')
  })

  it('drops people who already signed from the waiting list', () => {
    const [cycle] = toApprovalTrailCycles([
      {
        id: 'r1',
        status: 'PENDING',
        submittedAt: at,
        decidedAt: null,
        currentLevel: 2,
        requiredLevels: 2,
        submittedBy: { name: 'Staff' },
        policy: {
          approvers: [
            { userId: 'a', user: { name: 'Accountant' } },
            { userId: 'b', user: { name: 'Owner' } },
          ],
        },
        decisions: [
          {
            level: 1,
            decision: 'APPROVED',
            note: null,
            decidedAt: at,
            decidedBy: { name: 'Accountant' },
          },
        ],
      },
    ])
    expect(cycle.waitingFor).toEqual(['Owner'])
    expect(cycle.decisions[0]?.by).toBe('Accountant')
  })

  it('treats an empty assignee list as anyone with Approve permission', () => {
    const [cycle] = toApprovalTrailCycles([
      {
        id: 'r1',
        status: 'PENDING',
        submittedAt: at,
        decidedAt: null,
        currentLevel: 1,
        requiredLevels: 1,
        submittedBy: { name: 'Staff' },
        policy: { approvers: [] },
        decisions: [],
      },
    ])
    expect(cycle.waitingAnyone).toBe(true)
    expect(cycle.waitingFor).toEqual([])
  })

  it('names the person who approved a finished request', () => {
    const [cycle] = toApprovalTrailCycles([
      {
        id: 'r1',
        status: 'APPROVED',
        submittedAt: at,
        decidedAt: at,
        currentLevel: 1,
        requiredLevels: 1,
        submittedBy: { name: 'Staff' },
        policy: { approvers: [] },
        decisions: [
          {
            level: 1,
            decision: 'APPROVED',
            note: null,
            decidedAt: at,
            decidedBy: { name: 'Checker' },
          },
        ],
      },
    ])
    expect(cycle.waitingAnyone).toBe(false)
    expect(cycle.waitingFor).toEqual([])
    expect(cycle.decisions).toEqual([
      {
        level: 1,
        decision: 'APPROVED',
        by: 'Checker',
        at,
        note: null,
      },
    ])
  })
})
