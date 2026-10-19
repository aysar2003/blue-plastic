import 'server-only'

import type { Prisma, RecurringDocType, RecurringFrequency } from '@prisma/client'

import { addDays, addMonths, today, toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import type { ManualJournalInput } from '@/lib/validation/accounting'
import type { PurchaseDocumentInput } from '@/lib/validation/purchases'
import {
  payloadFromForm,
  type RecurringTemplateFormInput,
} from '@/lib/validation/recurring'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import * as journalService from '@/server/services/journal.service'
import * as purchaseService from '@/server/services/purchase.service'

const LIST_SELECT = {
  id: true,
  name: true,
  type: true,
  frequency: true,
  interval: true,
  nextRunOn: true,
  endOn: true,
  isActive: true,
  lastRunOn: true,
  lastDocumentId: true,
  lastDocumentKind: true,
  updatedAt: true,
} satisfies Prisma.RecurringTemplateSelect

export type RecurringListRow = {
  id: string
  name: string
  type: RecurringDocType
  frequency: RecurringFrequency
  interval: number
  nextRunOn: CalendarDate
  endOn: CalendarDate | null
  isActive: boolean
  lastRunOn: CalendarDate | null
  lastDocumentId: string | null
  lastDocumentKind: string | null
  due: boolean
}

function advanceDate(
  from: CalendarDate,
  frequency: RecurringFrequency,
  interval: number,
): CalendarDate {
  const n = Math.max(1, interval)
  switch (frequency) {
    case 'WEEKLY':
      return addDays(from, 7 * n)
    case 'MONTHLY':
      return addMonths(from, n)
    case 'QUARTERLY':
      return addMonths(from, 3 * n)
    case 'YEARLY':
      return addMonths(from, 12 * n)
  }
}

function present(row: {
  id: string
  name: string
  type: RecurringDocType
  frequency: RecurringFrequency
  interval: number
  nextRunOn: Date
  endOn: Date | null
  isActive: boolean
  lastRunOn: Date | null
  lastDocumentId: string | null
  lastDocumentKind: string | null
  updatedAt: Date
}, asOf: CalendarDate): RecurringListRow {
  const nextRunOn = toCalendarDate(row.nextRunOn)
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    frequency: row.frequency,
    interval: row.interval,
    nextRunOn,
    endOn: row.endOn ? toCalendarDate(row.endOn) : null,
    isActive: row.isActive,
    lastRunOn: row.lastRunOn ? toCalendarDate(row.lastRunOn) : null,
    lastDocumentId: row.lastDocumentId,
    lastDocumentKind: row.lastDocumentKind,
    due: row.isActive && nextRunOn <= asOf && (!row.endOn || toCalendarDate(row.endOn) >= nextRunOn),
  }
}

export async function list(ctx: OrgContext): Promise<RecurringListRow[]> {
  const asOf = today(ctx.organization.timeZone)
  const rows = await db.recurringTemplate.findMany({
    where: { orgId: ctx.orgId },
    select: LIST_SELECT,
    orderBy: [{ isActive: 'desc' }, { nextRunOn: 'asc' }, { name: 'asc' }],
  })
  return rows.map((row) => present(row, asOf))
}

export async function get(ctx: OrgContext, id: string) {
  const row = await db.recurringTemplate.findFirst({
    where: { id, orgId: ctx.orgId },
  })
  if (!row) throw notFound('Recurring transaction')
  const asOf = today(ctx.organization.timeZone)
  return {
    ...present(row, asOf),
    payload: row.payload as Record<string, unknown>,
  }
}

function assertCanCreate(ctx: OrgContext, type: RecurringDocType) {
  if (type === 'JOURNAL') {
    if (!ctx.permissions.has('journal:post')) {
      throw precondition('You need permission to post journals.')
    }
  } else if (!ctx.permissions.has('bill:create')) {
    throw precondition('You need permission to create bills and expenses.')
  }
}

export async function create(ctx: OrgContext, input: RecurringTemplateFormInput) {
  assertCanCreate(ctx, input.type)
  const payload = payloadFromForm(input)
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const row = await tx.recurringTemplate.create({
      data: {
        orgId: ctx.orgId,
        name: input.name,
        type: input.type,
        frequency: input.frequency,
        interval: input.interval,
        nextRunOn: toDate(input.nextRunOn),
        endOn: input.endOn ? toDate(input.endOn) : null,
        isActive: input.isActive,
        payload: payload as Prisma.InputJsonValue,
        createdById: ctx.userId,
      },
      select: LIST_SELECT,
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'RecurringTemplate',
        entityId: row.id,
        action: 'CREATE',
        after: { name: row.name, type: row.type, frequency: row.frequency },
      },
      meta,
    )
    return present(row, today(ctx.organization.timeZone))
  })
}

export async function update(ctx: OrgContext, id: string, input: RecurringTemplateFormInput) {
  const existing = await db.recurringTemplate.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, type: true, name: true },
  })
  if (!existing) throw notFound('Recurring transaction')
  assertCanCreate(ctx, input.type)

  const payload = payloadFromForm(input)
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const row = await tx.recurringTemplate.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        type: input.type,
        frequency: input.frequency,
        interval: input.interval,
        nextRunOn: toDate(input.nextRunOn),
        endOn: input.endOn ? toDate(input.endOn) : null,
        isActive: input.isActive,
        payload: payload as Prisma.InputJsonValue,
      },
      select: LIST_SELECT,
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'RecurringTemplate',
        entityId: row.id,
        action: 'UPDATE',
        before: { name: existing.name, type: existing.type },
        after: { name: row.name, type: row.type, frequency: row.frequency },
      },
      meta,
    )
    return present(row, today(ctx.organization.timeZone))
  })
}

export async function setActive(ctx: OrgContext, id: string, isActive: boolean) {
  const existing = await db.recurringTemplate.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, type: true },
  })
  if (!existing) throw notFound('Recurring transaction')
  assertCanCreate(ctx, existing.type)

  const row = await db.recurringTemplate.update({
    where: { id: existing.id },
    data: { isActive },
    select: LIST_SELECT,
  })
  return present(row, today(ctx.organization.timeZone))
}

export async function remove(ctx: OrgContext, id: string) {
  const existing = await db.recurringTemplate.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, name: true, type: true },
  })
  if (!existing) throw notFound('Recurring transaction')
  assertCanCreate(ctx, existing.type)

  const meta = await requestMeta()
  await db.$transaction(async (tx) => {
    await tx.recurringTemplate.delete({ where: { id: existing.id } })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'RecurringTemplate',
        entityId: existing.id,
        action: 'DELETE',
        before: { name: existing.name, type: existing.type },
      },
      meta,
    )
  })
  return { id: existing.id }
}

/**
 * Post one occurrence for this template on its nextRunOn date, then advance
 * the schedule. Returns the document that was created.
 */
export async function createInstance(ctx: OrgContext, id: string) {
  const row = await db.recurringTemplate.findFirst({
    where: { id, orgId: ctx.orgId },
  })
  if (!row) throw notFound('Recurring transaction')
  if (!row.isActive) throw precondition('This recurring transaction is paused.')

  const runOn = toCalendarDate(row.nextRunOn)
  if (row.endOn && toCalendarDate(row.endOn) < runOn) {
    throw precondition('This recurring transaction has ended.')
  }

  assertCanCreate(ctx, row.type)
  const payload = row.payload as Record<string, unknown>

  let documentId: string
  let documentKind: 'journal' | 'bill' | 'expense'
  let href: string
  let number: string

  if (row.type === 'JOURNAL') {
    const input = { ...payload, date: runOn } as ManualJournalInput
    const created = await journalService.createManual(ctx, input)
    documentId = created.id
    documentKind = 'journal'
    number = created.journalNumber
    href = `/journals/${created.id}`
  } else {
    const input = {
      ...payload,
      date: runOn,
      saveAsDraft: false,
    } as PurchaseDocumentInput
    const created = await purchaseService.create(ctx, row.type, input)
    documentId = created.id
    documentKind = row.type === 'EXPENSE' ? 'expense' : 'bill'
    number = created.number
    const slug = documentKind === 'expense' ? 'expenses' : 'bills'
    href = `/purchases/${slug}/${created.id}`
  }

  const next = advanceDate(runOn, row.frequency, row.interval)
  let stillActive = true
  if (row.endOn && next > toCalendarDate(row.endOn)) {
    stillActive = false
  }

  await db.recurringTemplate.update({
    where: { id: row.id },
    data: {
      nextRunOn: toDate(next),
      lastRunOn: toDate(runOn),
      lastDocumentId: documentId,
      lastDocumentKind: documentKind,
      isActive: stillActive,
    },
  })

  return {
    templateId: row.id,
    name: row.name,
    documentId,
    documentKind,
    number,
    href,
    runOn,
    nextRunOn: stillActive ? next : null,
  }
}

/** Create every template that is due today (or overdue) for this company. */
export async function createDue(ctx: OrgContext) {
  const asOf = today(ctx.organization.timeZone)
  const due = await db.recurringTemplate.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      nextRunOn: { lte: toDate(asOf) },
      OR: [{ endOn: null }, { endOn: { gte: toDate(asOf) } }],
    },
    select: { id: true, type: true },
    orderBy: { nextRunOn: 'asc' },
  })

  const created: Awaited<ReturnType<typeof createInstance>>[] = []
  const skipped: { id: string; message: string }[] = []

  for (const row of due) {
    try {
      // Skip ones the signed-in user cannot post.
      if (row.type === 'JOURNAL' && !ctx.permissions.has('journal:post')) {
        skipped.push({ id: row.id, message: 'No permission to post journals.' })
        continue
      }
      if (row.type !== 'JOURNAL' && !ctx.permissions.has('bill:create')) {
        skipped.push({ id: row.id, message: 'No permission to create bills.' })
        continue
      }
      created.push(await createInstance(ctx, row.id))
    } catch (error) {
      skipped.push({
        id: row.id,
        message: error instanceof Error ? error.message : 'Could not create.',
      })
    }
  }

  if (due.length === 0) {
    throw validation('Nothing is due today.')
  }

  return { created, skipped, asOf }
}
