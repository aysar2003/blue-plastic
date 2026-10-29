import 'server-only'

import type { EmployeeContractState, EmployeeDocumentKind, WageType } from '@prisma/client'

import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { money } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'
import * as hrFiles from '@/server/files/employee-hr-files'

export async function listContracts(ctx: OrgContext, opts: { employeeId?: string } = {}) {
  const rows = await db.employeeContract.findMany({
    where: {
      orgId: ctx.orgId,
      ...(opts.employeeId ? { employeeId: opts.employeeId } : {}),
    },
    include: {
      employee: { select: { id: true, name: true } },
    },
    orderBy: [{ dateStart: 'desc' }],
    take: 200,
  })
  return rows.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    name: row.name,
    state: row.state,
    dateStart: toCalendarDate(row.dateStart),
    dateEnd: row.dateEnd ? toCalendarDate(row.dateEnd) : null,
    wageType: row.wageType,
    wageAmount: row.wageAmount.toFixed(4),
    jobTitle: row.jobTitle,
    notes: row.notes,
    hasFile: Boolean(row.storageKey),
    originalName: row.originalName,
  }))
}

export async function createContract(
  ctx: OrgContext,
  input: {
    employeeId: string
    name: string
    dateStart: CalendarDate
    dateEnd?: string | null
    wageType?: WageType
    wageAmount?: string
    jobTitle?: string | null
    notes?: string | null
    state?: EmployeeContractState
  },
) {
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!employee) throw validation('Employee not found.', { employeeId: ['Choose an employee'] })

  const row = await db.employeeContract.create({
    data: {
      orgId: ctx.orgId,
      employeeId: input.employeeId,
      name: input.name,
      dateStart: toDate(input.dateStart),
      dateEnd: input.dateEnd ? toDate(input.dateEnd) : null,
      wageType: input.wageType ?? 'MONTHLY',
      wageAmount: money(input.wageAmount ?? '0'),
      jobTitle: input.jobTitle ?? null,
      notes: input.notes ?? null,
      state: input.state ?? 'DRAFT',
      createdById: ctx.userId,
    },
  })
  return row
}

export async function updateContract(
  ctx: OrgContext,
  id: string,
  input: {
    employeeId: string
    name: string
    dateStart: CalendarDate
    dateEnd?: string | null
    wageType?: WageType
    wageAmount?: string
    jobTitle?: string | null
    notes?: string | null
    state?: EmployeeContractState
  },
) {
  const existing = await db.employeeContract.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!existing) throw notFound('Contract')

  return db.employeeContract.update({
    where: { id },
    data: {
      name: input.name,
      dateStart: toDate(input.dateStart),
      dateEnd: input.dateEnd ? toDate(input.dateEnd) : null,
      wageType: input.wageType ?? 'MONTHLY',
      wageAmount: money(input.wageAmount ?? '0'),
      jobTitle: input.jobTitle ?? null,
      notes: input.notes ?? null,
      ...(input.state ? { state: input.state } : {}),
    },
  })
}

export async function setContractState(
  ctx: OrgContext,
  id: string,
  state: EmployeeContractState,
  syncWage?: boolean,
) {
  const row = await db.employeeContract.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!row) throw notFound('Contract')

  await db.$transaction(async (tx) => {
    await tx.employeeContract.update({ where: { id }, data: { state } })
    if (state === 'OPEN' && syncWage) {
      await tx.employee.update({
        where: { id: row.employeeId },
        data: {
          wageType: row.wageType,
          wageAmount: row.wageAmount,
          ...(row.jobTitle ? { jobTitle: row.jobTitle } : {}),
        },
      })
    }
  })
  return { id, state }
}

export async function removeContract(ctx: OrgContext, id: string) {
  const row = await db.employeeContract.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!row) throw notFound('Contract')
  // File cleanup: storage orphan is acceptable if delete fails; prefer deleting row.
  await db.employeeContract.delete({ where: { id } })
}

export async function uploadContractPdf(ctx: OrgContext, id: string, file: File) {
  await hrFiles.attachContractFile(ctx, id, file)
}

export async function listDocuments(ctx: OrgContext, employeeId: string) {
  const rows = await db.employeeDocument.findMany({
    where: { orgId: ctx.orgId, employeeId },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    kind: row.kind,
    title: row.title,
    originalName: row.originalName,
    contentType: row.contentType,
    byteSize: row.byteSize,
    notes: row.notes,
    createdAt: row.createdAt,
  }))
}

export async function uploadDocument(
  ctx: OrgContext,
  input: {
    employeeId: string
    kind: EmployeeDocumentKind
    title: string
    notes?: string | null
  },
  file: File,
) {
  return hrFiles.storeEmployeeDocument(ctx, input.employeeId, input, file)
}

export async function removeDocument(ctx: OrgContext, employeeId: string, id: string) {
  await hrFiles.removeEmployeeDocument(ctx, employeeId, id)
}
