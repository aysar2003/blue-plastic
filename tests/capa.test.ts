import { describe, expect, it } from 'vitest'

import { inRolledBackTransaction, makeOrg } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

suite('CAPA notes schema', () => {
  it('creates an open note', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const note = await tx.capaNote.create({
        data: {
          orgId: fixture.ctx.orgId,
          number: 'CAP-TEST-1',
          title: 'Root cause',
          status: 'OPEN',
        },
      })
      expect(note.status).toBe('OPEN')
    })
  })
})