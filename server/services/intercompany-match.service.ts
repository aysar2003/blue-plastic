import 'server-only'

import { Decimal } from '@/lib/money'
import { isIntercompanyMemo } from '@/lib/erp/intercompany-memo'
import { suggestIcPairs } from '@/lib/erp/consolidation-ownership'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, forbidden, notFound, precondition, validation } from '@/server/errors'
import {
  listGroupOrgIds,
  resolveGroupRootId,
} from '@/server/services/company-group.service'

async function assertGroupAdmin(ctx: OrgContext): Promise<string> {
  if (ctx.role !== 'OWNER' && ctx.role !== 'ADMIN' && !ctx.isSystemOwner) {
    throw forbidden('Group admin required.')
  }
  const rootOrgId = await resolveGroupRootId(ctx.orgId, ctx.organization.parentOrgId)
  if (!ctx.isSystemOwner) {
    const mainMembership = await db.membership.findUnique({
      where: { orgId_userId: { orgId: rootOrgId, userId: ctx.userId } },
      select: { role: true, status: true },
    })
    const ok =
      mainMembership?.status === 'ACTIVE' &&
      (mainMembership.role === 'OWNER' || mainMembership.role === 'ADMIN')
    if (!ok) throw forbidden('Only a main-company admin can manage intercompany matches.')
  }
  return rootOrgId
}

function journalDebitTotal(
  lines: { debit: Decimal | string; credit: Decimal | string }[],
): Decimal {
  return lines.reduce(
    (sum, line) => sum.plus(new Decimal(line.debit.toString())),
    new Decimal(0),
  )
}

/** Posted [IC] journals in the group that are not yet matched. */
export async function listUnmatchedIcJournals(ctx: OrgContext) {
  const rootOrgId = await assertGroupAdmin(ctx)
  const orgIds = await listGroupOrgIds(rootOrgId)

  const matched = await db.intercompanyMatch.findMany({
    where: { rootOrgId },
    select: { journalAId: true, journalBId: true },
  })
  const matchedIds = new Set(
    matched.flatMap((row) => [row.journalAId, row.journalBId]),
  )

  const journals = await db.journal.findMany({
    where: {
      orgId: { in: orgIds },
      status: 'POSTED',
      deletedAt: null,
      memo: { startsWith: '[IC]' },
    },
    select: {
      id: true,
      orgId: true,
      journalNumber: true,
      date: true,
      memo: true,
      organization: { select: { name: true } },
      lines: { select: { debit: true, credit: true } },
    },
    orderBy: [{ date: 'desc' }, { journalNumber: 'desc' }],
    take: 500,
  })

  return journals
    .filter((journal) => !matchedIds.has(journal.id))
    .filter((journal) => isIntercompanyMemo(journal.memo))
    .map((journal) => {
      const amount = journalDebitTotal(journal.lines)
      return {
        id: journal.id,
        orgId: journal.orgId,
        orgName: journal.organization.name,
        journalNumber: journal.journalNumber,
        date: journal.date.toISOString().slice(0, 10),
        memo: journal.memo,
        amount: amount.toFixed(4),
      }
    })
}

export async function listMatches(ctx: OrgContext) {
  const rootOrgId = await assertGroupAdmin(ctx)
  const rows = await db.intercompanyMatch.findMany({
    where: { rootOrgId },
    include: {
      journalA: {
        select: {
          id: true,
          journalNumber: true,
          date: true,
          orgId: true,
          organization: { select: { name: true } },
        },
      },
      journalB: {
        select: {
          id: true,
          journalNumber: true,
          date: true,
          orgId: true,
          organization: { select: { name: true } },
        },
      },
    },
    orderBy: { matchedAt: 'desc' },
    take: 200,
  })

  return rows.map((row) => ({
    id: row.id,
    amount: row.amount.toFixed(4),
    matchedAt: row.matchedAt.toISOString(),
    notes: row.notes,
    a: {
      id: row.journalA.id,
      number: row.journalA.journalNumber,
      date: row.journalA.date.toISOString().slice(0, 10),
      orgName: row.journalA.organization.name,
    },
    b: {
      id: row.journalB.id,
      number: row.journalB.journalNumber,
      date: row.journalB.date.toISOString().slice(0, 10),
      orgName: row.journalB.organization.name,
    },
  }))
}

export async function suggestMatches(ctx: OrgContext) {
  const unmatched = await listUnmatchedIcJournals(ctx)
  return suggestIcPairs(
    unmatched.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      date: row.date,
      amount: row.amount,
    })),
  ).map((pair) => {
    const a = unmatched.find((row) => row.id === pair.aId)!
    const b = unmatched.find((row) => row.id === pair.bId)!
    return {
      ...pair,
      a: { id: a.id, number: a.journalNumber, orgName: a.orgName, date: a.date },
      b: { id: b.id, number: b.journalNumber, orgName: b.orgName, date: b.date },
    }
  })
}

export async function confirmMatch(
  ctx: OrgContext,
  input: { journalAId: string; journalBId: string; notes?: string | null },
) {
  const rootOrgId = await assertGroupAdmin(ctx)
  if (input.journalAId === input.journalBId) {
    throw validation('Pick two different journals.')
  }

  const orgIds = await listGroupOrgIds(rootOrgId)
  const [journalA, journalB] = await Promise.all([
    db.journal.findFirst({
      where: { id: input.journalAId, orgId: { in: orgIds }, status: 'POSTED', deletedAt: null },
      include: { lines: { select: { debit: true, credit: true } } },
    }),
    db.journal.findFirst({
      where: { id: input.journalBId, orgId: { in: orgIds }, status: 'POSTED', deletedAt: null },
      include: { lines: { select: { debit: true, credit: true } } },
    }),
  ])
  if (!journalA || !journalB) throw notFound('Journal')
  if (!isIntercompanyMemo(journalA.memo) || !isIntercompanyMemo(journalB.memo)) {
    throw precondition('Both journals must be intercompany ([IC] memo).')
  }
  if (journalA.orgId === journalB.orgId) {
    throw validation('Match journals from two different companies in the group.')
  }

  const amountA = journalDebitTotal(journalA.lines).abs()
  const amountB = journalDebitTotal(journalB.lines).abs()
  if (!amountA.equals(amountB)) {
    throw validation(
      `Amounts differ (${amountA.toFixed(2)} vs ${amountB.toFixed(2)}). Confirm only equal IC pairs.`,
    )
  }

  const already = await db.intercompanyMatch.findFirst({
    where: {
      OR: [
        { journalAId: { in: [journalA.id, journalB.id] } },
        { journalBId: { in: [journalA.id, journalB.id] } },
      ],
    },
    select: { id: true },
  })
  if (already) throw conflict('One of those journals is already matched.')

  // Stable order: lower orgId first as A for uniqueness predictability.
  const [first, second] =
    journalA.orgId < journalB.orgId ? [journalA, journalB] : [journalB, journalA]

  return db.intercompanyMatch.create({
    data: {
      rootOrgId,
      journalAId: first.id,
      journalBId: second.id,
      amount: journalDebitTotal(first.lines).abs(),
      matchedById: ctx.userId,
      notes: input.notes?.trim() || null,
    },
  })
}

export async function unmatch(ctx: OrgContext, matchId: string) {
  const rootOrgId = await assertGroupAdmin(ctx)
  const row = await db.intercompanyMatch.findFirst({
    where: { id: matchId, rootOrgId },
    select: { id: true },
  })
  if (!row) throw notFound('Intercompany match')
  await db.intercompanyMatch.delete({ where: { id: row.id } })
  return { id: row.id }
}

export async function countUnmatched(ctx: OrgContext): Promise<number> {
  const unmatched = await listUnmatchedIcJournals(ctx)
  return unmatched.length
}
