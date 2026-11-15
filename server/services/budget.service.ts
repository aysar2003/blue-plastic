import 'server-only'

import type { AccountType, BudgetStatus, Prisma } from '@prisma/client'

import { parseCsv } from '@/lib/csv'
import {
  BUDGET_LINE_ACCOUNT_TYPES,
  budgetCellKey,
  collapseToFirstMonth,
  inflateAmount,
  monthsInRange,
  parseBudgetCsvRows,
  spreadAmountAcrossMonths,
  spreadEvenlyAcross,
  wouldExceedBudget,
} from '@/lib/erp/budget-deep'
import {
  debitNaturalActual,
  findOverBudgetBuckets,
  formatOverBudgetMessage,
  type BudgetControlLine,
} from '@/lib/erp/budget-control'
import { toCalendarDate, toDate } from '@/lib/date'
import { Decimal } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'

const ACCOUNT_TYPES = [...BUDGET_LINE_ACCOUNT_TYPES] as AccountType[]

function assertDraft(status: BudgetStatus) {
  if (status !== 'DRAFT') {
    throw precondition('Only draft budgets can be edited. Revise an approved budget to change it.')
  }
}

export async function list(ctx: OrgContext) {
  return db.budget.findMany({
    where: { orgId: ctx.orgId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
      version: true,
      notes: true,
      trackingCategoryId: true,
      _count: { select: { lines: true } },
    },
    orderBy: [{ startDate: 'desc' }, { version: 'desc' }],
  })
}

export async function get(ctx: OrgContext, id: string) {
  const budget = await db.budget.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      trackingCategory: { select: { id: true, name: true } },
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true, type: true } },
          trackingCategory: { select: { id: true, name: true } },
        },
        orderBy: [{ account: { code: 'asc' } }, { month: 'asc' }],
      },
    },
  })
  if (!budget) throw notFound('Budget')
  return budget
}

export async function create(
  ctx: OrgContext,
  input: {
    name: string
    startDate: string
    endDate: string
    notes?: string | null
    trackingCategoryId?: string | null
  },
) {
  if (input.startDate > input.endDate) throw validation('End date must be on or after start date.')
  if (input.trackingCategoryId) {
    const cls = await db.trackingCategory.findFirst({
      where: { id: input.trackingCategoryId, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!cls) throw validation('Class not found.')
  }

  return db.budget.create({
    data: {
      orgId: ctx.orgId,
      name: input.name.trim(),
      startDate: toDate(input.startDate),
      endDate: toDate(input.endDate),
      notes: input.notes?.trim() || null,
      trackingCategoryId: input.trackingCategoryId || null,
      status: 'DRAFT',
      version: 1,
    },
    select: { id: true },
  })
}

export async function upsertLine(
  ctx: OrgContext,
  input: {
    budgetId: string
    accountId: string
    month: number
    amount: string
    trackingCategoryId?: string | null
  },
) {
  const budget = await db.budget.findFirst({
    where: { id: input.budgetId, orgId: ctx.orgId },
    select: { id: true, status: true, startDate: true, endDate: true },
  })
  if (!budget) throw notFound('Budget')
  assertDraft(budget.status)

  if (input.month < 1 || input.month > 12) throw validation('Month must be 1–12.')
  const months = monthsInRange(toCalendarDate(budget.startDate), toCalendarDate(budget.endDate))
  if (!months.includes(input.month)) {
    throw validation('Month is outside this budget date range.')
  }

  const account = await db.ledgerAccount.findFirst({
    where: {
      id: input.accountId,
      orgId: ctx.orgId,
      isActive: true,
      type: { in: ACCOUNT_TYPES },
    },
    select: { id: true },
  })
  if (!account) throw validation('Account not found or not budgetable.')

  const classId = input.trackingCategoryId || null
  if (classId) {
    const cls = await db.trackingCategory.findFirst({
      where: { id: classId, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!cls) throw validation('Class not found.')
  }

  const amount = new Decimal(input.amount)
  if (!amount.isFinite()) throw validation('Amount must be a number.')

  const existing = await db.budgetLine.findFirst({
    where: {
      budgetId: budget.id,
      accountId: account.id,
      month: input.month,
      trackingCategoryId: classId,
    },
    select: { id: true },
  })

  if (existing) {
    await db.budgetLine.update({
      where: { id: existing.id },
      data: { amount: amount.toFixed(4) },
    })
    return { id: existing.id }
  }

  const row = await db.budgetLine.create({
    data: {
      orgId: ctx.orgId,
      budgetId: budget.id,
      accountId: account.id,
      month: input.month,
      trackingCategoryId: classId,
      amount: amount.toFixed(4),
    },
    select: { id: true },
  })
  return row
}

export async function deleteLine(ctx: OrgContext, lineId: string) {
  const line = await db.budgetLine.findFirst({
    where: { id: lineId, orgId: ctx.orgId },
    select: { id: true, budgetId: true, budget: { select: { status: true } } },
  })
  if (!line) return null
  assertDraft(line.budget.status)
  await db.budgetLine.delete({ where: { id: line.id } })
  return { budgetId: line.budgetId }
}

export async function approve(ctx: OrgContext, budgetId: string) {
  const budget = await db.budget.findFirst({
    where: { id: budgetId, orgId: ctx.orgId },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      trackingCategoryId: true,
      supersedesId: true,
      version: true,
    },
  })
  if (!budget) throw notFound('Budget')
  if (budget.status !== 'DRAFT') throw precondition('Only draft budgets can be approved.')

  const overlap = await db.budget.findFirst({
    where: {
      orgId: ctx.orgId,
      status: 'APPROVED',
      id: { not: budget.id },
      trackingCategoryId: budget.trackingCategoryId,
      startDate: { lte: budget.endDate },
      endDate: { gte: budget.startDate },
    },
    select: { id: true, name: true },
  })
  if (overlap) {
    throw conflict(
      `Another approved budget (${overlap.name}) already covers this date range` +
        (budget.trackingCategoryId ? ' for this fund class' : '') +
        '. Supersede it by revising, or change dates.',
    )
  }

  return db.$transaction(async (tx) => {
    if (budget.supersedesId) {
      await tx.budget.updateMany({
        where: { id: budget.supersedesId, orgId: ctx.orgId, status: 'APPROVED' },
        data: { status: 'SUPERSEDED' },
      })
    }
    return tx.budget.update({
      where: { id: budget.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: ctx.userId,
      },
      select: { id: true, status: true, version: true },
    })
  })
}

/** Clone an approved (or any) budget into a new DRAFT revision. */
export async function revise(ctx: OrgContext, budgetId: string) {
  const source = await get(ctx, budgetId)
  if (source.status === 'SUPERSEDED') {
    throw precondition('Superseded budgets cannot be revised. Open the current version.')
  }

  return db.$transaction(async (tx) => {
    const created = await tx.budget.create({
      data: {
        orgId: ctx.orgId,
        name: source.name,
        startDate: source.startDate,
        endDate: source.endDate,
        notes: source.notes,
        trackingCategoryId: source.trackingCategoryId,
        status: 'DRAFT',
        version: source.version + 1,
        supersedesId: source.id,
      },
      select: { id: true },
    })
    if (source.lines.length > 0) {
      await tx.budgetLine.createMany({
        data: source.lines.map((line) => ({
          orgId: ctx.orgId,
          budgetId: created.id,
          accountId: line.accountId,
          month: line.month,
          trackingCategoryId: line.trackingCategoryId,
          amount: line.amount.toFixed(4),
        })),
      })
    }
    return created
  })
}

export async function copyBudget(
  ctx: OrgContext,
  input: {
    sourceId: string
    name: string
    startDate: string
    endDate: string
    percent?: number
  },
) {
  const source = await get(ctx, input.sourceId)
  if (input.startDate > input.endDate) throw validation('End date must be on or after start date.')
  const percent = input.percent ?? 0
  const targetMonths = monthsInRange(input.startDate, input.endDate)
  if (targetMonths.length === 0) throw validation('Invalid date range.')

  return db.$transaction(async (tx) => {
    const created = await tx.budget.create({
      data: {
        orgId: ctx.orgId,
        name: input.name.trim(),
        startDate: toDate(input.startDate),
        endDate: toDate(input.endDate),
        notes: source.notes,
        trackingCategoryId: source.trackingCategoryId,
        status: 'DRAFT',
        version: 1,
      },
      select: { id: true },
    })

    // Map source lines by account+class; redistribute months onto target months by index / name.
    type Cell = { accountId: string; classId: string | null; byMonth: Map<number, Decimal> }
    const groups = new Map<string, Cell>()
    for (const line of source.lines) {
      const key = `${line.accountId}|${line.trackingCategoryId ?? ''}`
      const cell = groups.get(key) ?? {
        accountId: line.accountId,
        classId: line.trackingCategoryId,
        byMonth: new Map<number, Decimal>(),
      }
      cell.byMonth.set(
        line.month,
        (cell.byMonth.get(line.month) ?? new Decimal(0)).plus(line.amount.toString()),
      )
      groups.set(key, cell)
    }

    const rows: Prisma.BudgetLineCreateManyInput[] = []
    for (const cell of groups.values()) {
      const sourceMonths = [...cell.byMonth.keys()].sort((a, b) => a - b)
      for (let i = 0; i < targetMonths.length; i++) {
        const targetMonth = targetMonths[i]!
        const sourceMonth = sourceMonths[i] ?? sourceMonths[sourceMonths.length - 1]
        const raw = sourceMonth != null ? (cell.byMonth.get(sourceMonth) ?? new Decimal(0)) : new Decimal(0)
        const amount = inflateAmount(raw.toFixed(4), percent)
        if (new Decimal(amount).isZero()) continue
        rows.push({
          orgId: ctx.orgId,
          budgetId: created.id,
          accountId: cell.accountId,
          month: targetMonth,
          trackingCategoryId: cell.classId,
          amount,
        })
      }
    }
    if (rows.length > 0) await tx.budgetLine.createMany({ data: rows })
    return created
  })
}

export async function collapseBudgetToFirstMonth(ctx: OrgContext, budgetId: string) {
  const budget = await get(ctx, budgetId)
  assertDraft(budget.status)
  const months = monthsInRange(toCalendarDate(budget.startDate), toCalendarDate(budget.endDate))
  const first = months[0] ?? 1

  type Agg = { accountId: string; classId: string | null; total: Decimal; ids: string[] }
  const groups = new Map<string, Agg>()
  for (const line of budget.lines) {
    const key = `${line.accountId}|${line.trackingCategoryId ?? ''}`
    const g = groups.get(key) ?? {
      accountId: line.accountId,
      classId: line.trackingCategoryId,
      total: new Decimal(0),
      ids: [],
    }
    g.total = g.total.plus(line.amount.toString())
    g.ids.push(line.id)
    groups.set(key, g)
  }

  await db.$transaction(async (tx) => {
    for (const g of groups.values()) {
      await tx.budgetLine.deleteMany({ where: { id: { in: g.ids } } })
      const collapsed = collapseToFirstMonth(
        Object.fromEntries(months.map((m) => [m, m === first ? g.total.toFixed(4) : '0'])),
      )
      const amount = collapsed[first] ?? g.total.toFixed(4)
      if (new Decimal(amount).isZero()) continue
      await tx.budgetLine.create({
        data: {
          orgId: ctx.orgId,
          budgetId: budget.id,
          accountId: g.accountId,
          month: first,
          trackingCategoryId: g.classId,
          amount,
        },
      })
    }
  })
  return { id: budget.id }
}

export async function spreadBudgetEvenly(ctx: OrgContext, budgetId: string) {
  const budget = await get(ctx, budgetId)
  assertDraft(budget.status)
  const months = monthsInRange(toCalendarDate(budget.startDate), toCalendarDate(budget.endDate))
  if (months.length === 0) throw validation('Budget has no months.')

  type Agg = { accountId: string; classId: string | null; total: Decimal; ids: string[] }
  const groups = new Map<string, Agg>()
  for (const line of budget.lines) {
    const key = `${line.accountId}|${line.trackingCategoryId ?? ''}`
    const g = groups.get(key) ?? {
      accountId: line.accountId,
      classId: line.trackingCategoryId,
      total: new Decimal(0),
      ids: [],
    }
    g.total = g.total.plus(line.amount.toString())
    g.ids.push(line.id)
    groups.set(key, g)
  }

  await db.$transaction(async (tx) => {
    for (const g of groups.values()) {
      await tx.budgetLine.deleteMany({ where: { id: { in: g.ids } } })
      const spread = spreadEvenlyAcross(g.total.toFixed(4), months)
      for (const month of months) {
        const amount = spread[month] ?? '0'
        if (new Decimal(amount).isZero()) continue
        await tx.budgetLine.create({
          data: {
            orgId: ctx.orgId,
            budgetId: budget.id,
            accountId: g.accountId,
            month,
            trackingCategoryId: g.classId,
            amount,
          },
        })
      }
    }
  })
  return { id: budget.id }
}

export async function importCsv(
  ctx: OrgContext,
  input: { budgetId: string; csv: string; commit: boolean },
) {
  const budget = await db.budget.findFirst({
    where: { id: input.budgetId, orgId: ctx.orgId },
    select: { id: true, status: true, startDate: true, endDate: true },
  })
  if (!budget) throw notFound('Budget')
  assertDraft(budget.status)

  const { rows: tableRows } = parseCsv(input.csv)
  const { rows, issues } = parseBudgetCsvRows(tableRows)
  const allowedMonths = new Set(
    monthsInRange(toCalendarDate(budget.startDate), toCalendarDate(budget.endDate)),
  )

  const codes = [...new Set(rows.map((r) => r.accountCode))]
  const accounts = await db.ledgerAccount.findMany({
    where: { orgId: ctx.orgId, code: { in: codes }, type: { in: ACCOUNT_TYPES } },
    select: { id: true, code: true },
  })
  const accountByCode = new Map(accounts.map((a) => [a.code, a.id]))

  const classNames = [...new Set(rows.map((r) => r.className).filter(Boolean))] as string[]
  const classes = classNames.length
    ? await db.trackingCategory.findMany({
        where: { orgId: ctx.orgId, name: { in: classNames } },
        select: { id: true, name: true },
      })
    : []
  const classByName = new Map(classes.map((c) => [c.name, c.id]))

  const ready: {
    accountId: string
    month: number
    amount: string
    trackingCategoryId: string | null
  }[] = []

  for (const row of rows) {
    const accountId = accountByCode.get(row.accountCode)
    if (!accountId) {
      issues.push({ line: row.line, message: `Unknown account code ${row.accountCode}` })
      continue
    }
    if (!allowedMonths.has(row.month)) {
      issues.push({ line: row.line, message: `Month ${row.month} outside budget range` })
      continue
    }
    let classId: string | null = null
    if (row.className) {
      classId = classByName.get(row.className) ?? null
      if (!classId) {
        issues.push({ line: row.line, message: `Unknown class ${row.className}` })
        continue
      }
    }
    ready.push({
      accountId,
      month: row.month,
      amount: row.amount,
      trackingCategoryId: classId,
    })
  }

  if (!input.commit || issues.length > 0) {
    return { ok: issues.length === 0, issues, readyCount: ready.length, committed: false }
  }

  for (const row of ready) {
    await upsertLine(ctx, {
      budgetId: budget.id,
      accountId: row.accountId,
      month: row.month,
      amount: row.amount,
      trackingCategoryId: row.trackingCategoryId,
    })
  }
  return { ok: true, issues: [], readyCount: ready.length, committed: true }
}

/**
 * Assert EXPENSE/COGS proposed lines stay within APPROVED monthly budgets.
 * Modes: off (no-op), warn (confirm via acknowledgeBudgetOverspend), enforce (hard refuse).
 * No APPROVED budget for the date → allow.
 */
export async function assertWithinBudget(
  ctx: OrgContext,
  input: {
    date: string
    lines: BudgetControlLine[]
    acknowledgeBudgetOverspend?: boolean
  },
) {
  const mode = ctx.features.budgetControlMode
  if (mode === 'off') return

  const spendLines = input.lines.filter((l) =>
    (['COGS', 'EXPENSE'] as string[]).includes(l.accountType),
  )
  if (spendLines.length === 0) return

  const month = Number(input.date.slice(5, 7))
  const day = toDate(input.date)

  const budgets = await db.budget.findMany({
    where: {
      orgId: ctx.orgId,
      status: 'APPROVED',
      startDate: { lte: day },
      endDate: { gte: day },
    },
    select: {
      id: true,
      lines: {
        where: {
          month,
          accountId: { in: [...new Set(spendLines.map((l) => l.accountId))] },
        },
        select: {
          accountId: true,
          amount: true,
          trackingCategoryId: true,
          account: { select: { code: true } },
        },
      },
    },
  })
  if (budgets.length === 0) return

  const budgetByCell = new Map<string, { amount: string; accountCode: string }>()
  for (const budget of budgets) {
    for (const line of budget.lines) {
      const key = budgetCellKey(line.accountId, month, line.trackingCategoryId)
      const prev = budgetByCell.get(key)
      const next = new Decimal(prev?.amount ?? '0').plus(line.amount.toString()).toFixed(4)
      budgetByCell.set(key, { amount: next, accountCode: line.account.code })
    }
  }
  if (budgetByCell.size === 0) return

  const accountIds = [...new Set([...budgetByCell.keys()].map((k) => k.split('|')[0]!))]
  const year = Number(input.date.slice(0, 4))
  const monthStart = `${input.date.slice(0, 7)}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const monthEnd = `${input.date.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`

  const aggregates = await db.journalLine.groupBy({
    by: ['accountId', 'trackingCategoryId'],
    where: {
      orgId: ctx.orgId,
      accountId: { in: accountIds },
      journal: {
        status: 'POSTED',
        date: { gte: toDate(monthStart), lte: toDate(monthEnd) },
      },
    },
    _sum: { debit: true, credit: true },
  })

  const accounts = await db.ledgerAccount.findMany({
    where: { id: { in: accountIds }, orgId: ctx.orgId },
    select: { id: true, type: true },
  })
  const typeById = new Map(accounts.map((a) => [a.id, a.type]))

  const actualByCell = new Map<string, string>()
  for (const row of aggregates) {
    const type = typeById.get(row.accountId) ?? 'EXPENSE'
    const actual = debitNaturalActual({
      type,
      debit: row._sum.debit?.toString() ?? '0',
      credit: row._sum.credit?.toString() ?? '0',
    })
    actualByCell.set(budgetCellKey(row.accountId, month, row.trackingCategoryId), actual)
  }

  // Also match unclassed budget cells against classed spend by falling back to null class budget.
  const over = findOverBudgetBuckets({
    month,
    lines: spendLines,
    budgetByCell,
    actualByCell,
  })

  // Fallback: if line has a class but only unclassed budget exists, check that cell.
  const extra: typeof over = []
  for (const line of spendLines) {
    if (!line.trackingCategoryId) continue
    const classKey = budgetCellKey(line.accountId, month, line.trackingCategoryId)
    if (budgetByCell.has(classKey)) continue
    const nullKey = budgetCellKey(line.accountId, month, null)
    const budget = budgetByCell.get(nullKey)
    if (!budget) continue
    const proposed = line.amount
    const actual = actualByCell.get(nullKey) ?? '0'
    if (wouldExceedBudget({ budgeted: budget.amount, actualPosted: actual, proposed })) {
      extra.push({
        accountId: line.accountId,
        accountCode: budget.accountCode,
        month,
        trackingCategoryId: null,
        budgeted: budget.amount,
        actualPosted: actual,
        proposed,
      })
    }
  }

  const all = [...over, ...extra]
  if (all.length === 0) return

  const message = formatOverBudgetMessage(all)
  if (mode === 'warn') {
    if (input.acknowledgeBudgetOverspend) return
    throw validation(message, {
      acknowledgeBudgetOverspend: [
        'This posting exceeds the approved budget. Confirm to post anyway, or save as a draft.',
      ],
    })
  }
  throw precondition(message)
}

export { spreadAmountAcrossMonths, monthsInRange }
