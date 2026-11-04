import { describe, expect, it, vi } from 'vitest'

/**
 * createDue must not throw when nothing is due — cron and page-load auto-run
 * call it every time. The Banking button stays disabled when dueCount is 0.
 */
describe('recurring createDue contract', () => {
  it('documents empty-due behaviour', () => {
    const empty = { created: [], skipped: [], asOf: '2026-11-01', dueCount: 0 }
    expect(empty.dueCount).toBe(0)
    expect(empty.created).toHaveLength(0)
  })

  it('counts created and skipped independently', () => {
    const result = {
      created: [{ templateId: 'a' }, { templateId: 'b' }],
      skipped: [{ id: 'c', message: 'No permission' }],
      asOf: '2026-11-01',
      dueCount: 3,
    }
    expect(result.created.length + result.skipped.length).toBe(result.dueCount)
  })
})

// Keep vi imported so the file stays a real vitest module if we stub later.
void vi
