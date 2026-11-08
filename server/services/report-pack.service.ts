import 'server-only'

import { addMonths, startOfMonth, toCalendarDate, toDate, today, type CalendarDate } from '@/lib/date'
import {
  assertPackReportKeys,
  nextRunAfter,
} from '@/lib/report-packs'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import type { CsvCell } from '@/server/reports/csv'
import { tableReport } from '@/server/reports/catalogue'
import {
  encodePackXlsxBody,
  renderMultiSheetXlsx,
  type ListXlsxColumn,
  type ListXlsxSheet,
} from '@/server/reports/list-xlsx'
import { balanceSheet, cashFlow, profitAndLoss } from '@/server/reports/statements'
import * as mailService from '@/server/services/mail.service'

export type ReportPackInput = {
  name: string
  description?: string | null
  reportKeys: string[]
  cadence: 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
  emailTo?: string | null
  isActive?: boolean
}

function parseKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((value) => String(value)).filter(Boolean)
}

export async function list(ctx: OrgContext) {
  assertPermission(ctx, 'report:read')
  const rows = await db.reportPack.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      reportKeys: true,
      cadence: true,
      emailTo: true,
      nextRunAt: true,
      lastRunAt: true,
      isActive: true,
      _count: { select: { runs: true } },
    },
  })
  return rows.map((row) => ({
    ...row,
    reportKeys: parseKeys(row.reportKeys),
    runCount: row._count.runs,
  }))
}

export async function get(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'report:read')
  const pack = await db.reportPack.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true,
      name: true,
      description: true,
      reportKeys: true,
      cadence: true,
      emailTo: true,
      nextRunAt: true,
      lastRunAt: true,
      isActive: true,
      runs: {
        orderBy: { ranAt: 'desc' },
        take: 20,
        select: {
          id: true,
          ranAt: true,
          fromDate: true,
          toDate: true,
          status: true,
          message: true,
        },
      },
    },
  })
  if (!pack) throw notFound('Report pack')
  return {
    ...pack,
    reportKeys: parseKeys(pack.reportKeys),
    runs: pack.runs.map((run) => ({
      ...run,
      fromDate: toCalendarDate(run.fromDate),
      toDate: toCalendarDate(run.toDate),
    })),
  }
}

export async function create(ctx: OrgContext, input: ReportPackInput) {
  assertPermission(ctx, 'report:export')
  const name = input.name.trim()
  if (!name) throw validation('Name the pack.')
  const keyError = assertPackReportKeys(input.reportKeys)
  if (keyError) throw validation(keyError)

  const cadence = input.cadence
  const nextRunAt =
    cadence === 'MANUAL' || input.isActive === false ? null : nextRunAfter(cadence, new Date())

  return db.reportPack.create({
    data: {
      orgId: ctx.orgId,
      name,
      description: input.description?.trim() || null,
      reportKeys: input.reportKeys,
      cadence,
      emailTo: input.emailTo?.trim() || null,
      nextRunAt,
      isActive: input.isActive !== false,
      createdById: ctx.userId,
    },
    select: { id: true, name: true },
  })
}

export async function update(ctx: OrgContext, id: string, input: ReportPackInput) {
  assertPermission(ctx, 'report:export')
  const existing = await db.reportPack.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!existing) throw notFound('Report pack')

  const name = input.name.trim()
  if (!name) throw validation('Name the pack.')
  const keyError = assertPackReportKeys(input.reportKeys)
  if (keyError) throw validation(keyError)

  const cadence = input.cadence
  const isActive = input.isActive !== false
  const nextRunAt = cadence === 'MANUAL' || !isActive ? null : nextRunAfter(cadence, new Date())

  return db.reportPack.update({
    where: { id },
    data: {
      name,
      description: input.description?.trim() || null,
      reportKeys: input.reportKeys,
      cadence,
      emailTo: input.emailTo?.trim() || null,
      isActive,
      nextRunAt,
    },
    select: { id: true, name: true },
  })
}

export async function remove(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'report:export')
  const existing = await db.reportPack.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!existing) throw notFound('Report pack')
  await db.reportPack.delete({ where: { id } })
  return { id }
}

async function sheetForKey(
  ctx: OrgContext,
  key: string,
  range: { from: CalendarDate; to: CalendarDate },
): Promise<ListXlsxSheet> {
  const asOf = range.to
  const catalogue = tableReport(key)
  if (catalogue) {
    const table = await catalogue.build({
      ctx,
      range,
      asOf,
      filters: {},
    })
    const columns: ListXlsxColumn[] = table.columns.map((column) => {
      const format = column.kind ?? column.format
      return {
        header: column.label,
        width: Math.min(40, Math.max(12, column.label.length + 4)),
        kind:
          format === 'money' || format === 'signed'
            ? 'money'
            : format === 'number'
              ? 'number'
              : format === 'date' || format === 'datetime'
                ? 'date'
                : 'text',
      }
    })
    const rows: CsvCell[][] = table.rows.map((row) =>
      table.columns.map((column) => row.cells[column.key] ?? ''),
    )
    if (table.totals) {
      rows.push(table.columns.map((column) => table.totals?.[column.key] ?? ''))
    }
    return { name: catalogue.title, title: catalogue.title, columns, rows }
  }

  if (key === 'profit-loss') {
    const statement = await profitAndLoss(ctx.orgId, { from: range.from, to: range.to })
    return {
      name: 'Profit and Loss',
      title: 'Profit and Loss',
      columns: [
        { header: 'Account', width: 40 },
        { header: 'Amount', width: 14, kind: 'money' },
      ],
      rows: statement.sections.flatMap((section) =>
        section.rows.map((row) => [`${row.code} ${row.name}`, row.amount] as CsvCell[]),
      ),
    }
  }
  if (key === 'balance-sheet') {
    const statement = await balanceSheet(ctx.orgId, asOf)
    return {
      name: 'Balance Sheet',
      title: 'Balance Sheet',
      columns: [
        { header: 'Account', width: 40 },
        { header: 'Amount', width: 14, kind: 'money' },
      ],
      rows: statement.sections.flatMap((section) =>
        section.rows.map((row) => [`${row.code} ${row.name}`, row.amount] as CsvCell[]),
      ),
    }
  }
  if (key === 'cash-flow') {
    const statement = await cashFlow(ctx.orgId, { from: range.from, to: range.to })
    return {
      name: 'Cash Flows',
      title: 'Statement of Cash Flows',
      columns: [
        { header: 'Section', width: 14 },
        { header: 'Line', width: 36 },
        { header: 'Amount', width: 14, kind: 'money' },
      ],
      rows: [
        ['operating', 'Net income', statement.netIncome],
        ...statement.operating.lines.map(
          (row) => ['operating', row.label, row.amount] as CsvCell[],
        ),
        ...statement.investing.lines.map(
          (row) => ['investing', row.label, row.amount] as CsvCell[],
        ),
        ...statement.financing.lines.map(
          (row) => ['financing', row.label, row.amount] as CsvCell[],
        ),
        ['', 'Net change in cash', statement.netChange],
      ],
    }
  }

throw precondition(`Report "${key}" cannot be built into a pack yet.`)
}

export async function runPack(
  ctx: OrgContext,
  packId: string,
  range?: { from: CalendarDate; to: CalendarDate },
) {
  assertPermission(ctx, 'report:export')
  const pack = await db.reportPack.findFirst({
    where: { id: packId, orgId: ctx.orgId },
  })
  if (!pack) throw notFound('Report pack')

  const to = range?.to ?? today(ctx.organization.timeZone)
  const from = range?.from ?? startOfMonth(addMonths(to, -1))
  const keys = parseKeys(pack.reportKeys)

  const sheets: ListXlsxSheet[] = []
  for (const key of keys) {
    sheets.push(await sheetForKey(ctx, key, { from, to }))
  }

  const xlsx = await renderMultiSheetXlsx({
    org: ctx.organization,
    title: pack.name,
    subtitle: `${from} to ${to}`,
    currency: ctx.organization.baseCurrency,
    sheets,
  })
  const body = encodePackXlsxBody(xlsx)
  const sectionList = sheets.map((sheet) => `· ${sheet.title ?? sheet.name}`).join('\n')

  const run = await db.reportPackRun.create({
    data: {
      orgId: ctx.orgId,
      packId: pack.id,
      fromDate: toDate(from),
      toDate: toDate(to),
      status: 'OK',
      body,
      createdById: ctx.userId,
    },
    select: { id: true },
  })

  const next =
    pack.cadence === 'MANUAL' || !pack.isActive
      ? null
      : nextRunAfter(pack.cadence, new Date())

  await db.reportPack.update({
    where: { id: pack.id },
    data: { lastRunAt: new Date(), nextRunAt: next },
  })

  if (pack.emailTo) {
    try {
      await mailService.sendOrgMail(ctx, {
        to: pack.emailTo,
        subject: `${pack.name} · ${from} to ${to}`,
        text: `Your report pack "${pack.name}" is ready as Excel.\n\nRange: ${from} to ${to}\nReports:\n${sectionList}\n\nDownload from Reports → Packs in Som ERP (run ${run.id}).`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email delivery failed'
      await db.reportPackRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', message: `Pack built; email failed: ${message}` },
      })
      return { id: run.id, packId: pack.id, from, to, emailFailed: true as const }
    }
  }

  return { id: run.id, packId: pack.id, from, to }
}

export async function getRun(ctx: OrgContext, runId: string) {
  assertPermission(ctx, 'report:read')
  const run = await db.reportPackRun.findFirst({
    where: { id: runId, orgId: ctx.orgId },
    select: {
      id: true,
      packId: true,
      ranAt: true,
      fromDate: true,
      toDate: true,
      status: true,
      message: true,
      body: true,
      pack: { select: { name: true } },
    },
  })
  if (!run) throw notFound('Pack run')
  return {
    ...run,
    fromDate: toCalendarDate(run.fromDate),
    toDate: toCalendarDate(run.toDate),
  }
}

/** Cron: build every due active pack across organisations. */
export async function runDueForAllOrganizations() {
  const now = new Date()
  const due = await db.reportPack.findMany({
    where: {
      isActive: true,
      cadence: { not: 'MANUAL' },
      nextRunAt: { lte: now },
    },
    select: { id: true, orgId: true },
    take: 50,
  })

  let ran = 0
  let failed = 0
  for (const pack of due) {
    const membership = await db.membership.findFirst({
      where: { orgId: pack.orgId, status: 'ACTIVE' },
      select: { userId: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!membership) {
      failed += 1
      continue
    }
    const org = await db.organization.findUnique({
      where: { id: pack.orgId },
      select: {
        id: true,
        name: true,
        baseCurrency: true,
        timeZone: true,
        fiscalYearStartMonth: true,
      },
    })
    if (!org) {
      failed += 1
      continue
    }
    const ctx = {
      orgId: org.id,
      userId: membership.userId,
      organization: org,
      permissions: new Set(['report:read', 'report:export']),
      features: {},
    } as unknown as OrgContext
    try {
      await runPack(ctx, pack.id)
      ran += 1
    } catch {
      failed += 1
    }
  }
  return { due: due.length, ran, failed }
}
