import 'server-only'

import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import type { Tx } from '@/server/db'
import { notFound } from '@/server/errors'

/**
 * Deleting a transaction, once, for the whole system.
 *
 * **What "delete" means here.** The record is marked deleted and disappears —
 * from every list, every selector, every search, every report and every balance.
 * As far as the application is concerned it is gone, and that is what the person
 * who clicked Delete asked for and what they get.
 *
 * **What it does not mean.** The row is not removed from PostgreSQL, and neither
 * is its journal, its lines, or the stock it moved. Nothing is edited: no amount
 * changes, no line is rewritten, no running total is recomputed. A posted entry
 * stays exactly as it was posted, for ever.
 *
 * Those two things are compatible because balances in this system are *derived*.
 * There is no stored balance to correct and no rebuild to run (see
 * `server/accounting/balances.ts`); every figure is an aggregate over journal
 * lines, and every one of those aggregates now excludes `DELETED` journals. So
 * marking the journal is sufficient — the money leaves the reports the moment the
 * status changes, and it leaves them everywhere at once, because there is one
 * definition of which journals count rather than one per report.
 *
 * Keeping the row is not sentimentality. It is the difference between "this
 * invoice never existed" and "this invoice was entered on the 3rd and withdrawn
 * on the 9th by Amina" — and the second is the one an auditor, or the owner in
 * six months, actually needs. The immutability triggers are untouched: R4 still
 * refuses every UPDATE to a posted journal except this one, and refuses it unless
 * the deletion stamp is set in the same statement.
 *
 * **Not exposed as anything else on the record.** There is no Void branching in
 * front of the person — one verb, Delete. Trash can Restore a mis-click; that
 * path lives under Settings → Trash, not on the live document.
 */

/** The stamp written on every soft-deleted record. */
export type DeletionStamp = {
  deletedAt: Date
  deletedById: string | null
  deleteReason: string | null
}

export function deletionStamp(ctx: OrgContext, reason?: string | null): DeletionStamp {
  return {
    deletedAt: new Date(),
    deletedById: ctx.userId,
    deleteReason: reason?.trim() || null,
  }
}

/** Rows already deleted are invisible. Spread into any `where` that lists records. */
export const NOT_DELETED = { deletedAt: null } as const

/**
 * Mark a journal and anything attached to it deleted.
 *
 * Attached means two things. A journal that reverses this one goes with it —
 * leaving a reversal behind after its original was withdrawn would post the
 * mirror of an entry that no longer counts, which is exactly backwards. And the
 * stock movements the journal carried are detached from the active ledger by the
 * same act: they are found through the journal, and the stock queries exclude
 * deleted journals, so no movement row has to be touched.
 *
 * Idempotent. Deleting something already deleted changes nothing and does not
 * fail, because two people clicking Delete on the same row is ordinary.
 */
export async function deleteJournals(
  tx: Tx,
  ctx: OrgContext,
  journalIds: (string | null | undefined)[],
  reason?: string | null,
  options?: { audit?: boolean },
): Promise<number> {
  const ids = [...new Set(journalIds.filter(Boolean) as string[])]
  if (ids.length === 0) return 0

  // Reversals first: a reversal points at its original, and both are withdrawn
  // together whichever end the delete arrives from.
  const related = await tx.journal.findMany({
    where: {
      orgId: ctx.orgId,
      OR: [{ id: { in: ids } }, { reversalOfId: { in: ids } }],
      status: { notIn: ['DELETED'] },
    },
    select: { id: true, journalNumber: true, status: true },
  })

  if (related.length === 0) return 0

  const stamp = deletionStamp(ctx, reason)

  // One at a time rather than updateMany: the immutability trigger is a row
  // trigger, and a failure has to name the entry it refused.
  for (const journal of related) {
    await tx.journal.update({
      where: { id: journal.id },
      data: { status: 'DELETED', ...stamp },
    })
  }

  // A document delete writes its own trash line. A second line for the journal
  // it carried would show one act as two, and would point at a ledger row the
  // working books no longer open.
  if (options?.audit !== false) {
    await writeAudit(tx, ctx, {
      entity: 'Journal',
      entityId: related[0].id,
      action: 'DELETE',
      before: { entries: related.map((journal) => journal.journalNumber) },
      after: { status: 'DELETED', reason: stamp.deleteReason },
    })
  }

  return related.length
}

/** Clear the soft-delete stamp so a row is visible in the working books again. */
export const CLEAR_DELETION = {
  deletedAt: null,
  deletedById: null,
  deleteReason: null,
} as const

/**
 * Put deleted journals back into the books.
 *
 * Status goes back to what deletion took away: a reversing entry returns as
 * POSTED; an original that still has its reversal beside it returns as
 * REVERSED; otherwise POSTED. The stamp clears in the same statement — the
 * immutability trigger permits only that transition.
 *
 * Idempotent. Restoring something already live changes nothing.
 */
export async function restoreJournals(
  tx: Tx,
  ctx: OrgContext,
  journalIds: (string | null | undefined)[],
  options?: { audit?: boolean },
): Promise<number> {
  const ids = [...new Set(journalIds.filter(Boolean) as string[])]
  if (ids.length === 0) return 0

  const related = await tx.journal.findMany({
    where: {
      orgId: ctx.orgId,
      OR: [{ id: { in: ids } }, { reversalOfId: { in: ids } }],
      status: 'DELETED',
    },
    select: { id: true, journalNumber: true, reversalOfId: true },
  })

  if (related.length === 0) return 0

  const relatedIds = new Set(related.map((journal) => journal.id))
  const hasReversal = new Set(
    related.filter((journal) => journal.reversalOfId && relatedIds.has(journal.reversalOfId)).map(
      (journal) => journal.reversalOfId as string,
    ),
  )

  for (const journal of related) {
    const status = journal.reversalOfId
      ? 'POSTED'
      : hasReversal.has(journal.id)
        ? 'REVERSED'
        : 'POSTED'

    await tx.journal.update({
      where: { id: journal.id },
      data: { status, ...CLEAR_DELETION },
    })
  }

  if (options?.audit !== false) {
    await writeAudit(tx, ctx, {
      entity: 'Journal',
      entityId: related[0].id,
      action: 'RESTORE',
      before: { status: 'DELETED', entries: related.map((journal) => journal.journalNumber) },
      after: { status: 'RESTORED' },
    })
  }

  return related.length
}

/**
 * Soft-delete a record and its journal in one transaction.
 *
 * The generic half of every `remove` in the services: stamp the row, withdraw the
 * ledger entries, write the audit line. What each service still does for itself
 * is the part that is specific to it — putting a purchase order's received count
 * back, releasing the payments a deposit had banked, recomputing what a bill's
 * payments leave outstanding.
 */
export async function softDeleteDocument(
  tx: Tx,
  ctx: OrgContext,
  input: {
    /**
     * Writes the stamp onto the record's own row. A callback rather than a
     * delegate, so each caller keeps Prisma's types for its own table.
     */
    mark: (stamp: DeletionStamp) => Promise<unknown>
    entity: string
    id: string
    number: string
    journalIds?: (string | null | undefined)[]
    reason?: string | null
    /** Anything worth keeping in the audit line. */
    before?: Record<string, unknown>
  },
): Promise<{ id: string; number: string }> {
  const meta = await requestMeta()
  const stamp = deletionStamp(ctx, input.reason)

  await deleteJournals(tx, ctx, input.journalIds ?? [], input.reason, { audit: false })

  await input.mark(stamp)

  await writeAudit(
    tx,
    ctx,
    {
      entity: input.entity,
      entityId: input.id,
      action: 'DELETE',
      before: { number: input.number, ...input.before },
      after: { deletedAt: stamp.deletedAt.toISOString(), reason: stamp.deleteReason },
    },
    meta,
  )

  return { id: input.id, number: input.number }
}

/**
 * Clear a soft-deleted record's stamp and put its journals back.
 *
 * Side-effects unique to one document type (stock, applications, order counts)
 * stay in that service's restore. This is only the shared half.
 */
export async function restoreSoftDeletedDocument(
  tx: Tx,
  ctx: OrgContext,
  input: {
    clear: () => Promise<unknown>
    entity: string
    id: string
    number: string
    journalIds?: (string | null | undefined)[]
    before?: Record<string, unknown>
  },
): Promise<{ id: string; number: string }> {
  const meta = await requestMeta()

  await input.clear()
  await restoreJournals(tx, ctx, input.journalIds ?? [], { audit: false })

  await writeAudit(
    tx,
    ctx,
    {
      entity: input.entity,
      entityId: input.id,
      action: 'RESTORE',
      before: { number: input.number, status: 'DELETED', ...input.before },
      after: { deletedAt: null },
    },
    meta,
  )

  return { id: input.id, number: input.number }
}

/** Refuse politely rather than deleting twice. */
export function assertNotDeleted(
  record: { deletedAt: Date | null } | null,
  what: string,
): asserts record is { deletedAt: Date | null } {
  if (!record) throw notFound(what)
}
