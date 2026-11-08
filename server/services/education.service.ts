import 'server-only'

import { Decimal } from '@/lib/money'
import { toDate, today } from '@/lib/date'
import {
  assertTermDates,
  canBillEnrollment,
  canWithdrawEnrollment,
  enrollmentCount,
  normalizeScholarshipPercent,
  type EnrollmentStatus,
} from '@/lib/erp/education'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'
import * as salesService from '@/server/services/sales.service'

export async function listPrograms(ctx: OrgContext) {
  return db.academicProgram.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    orderBy: { name: 'asc' },
  })
}

export async function upsertProgram(
  ctx: OrgContext,
  input: { id?: string; name: string; code?: string | null },
) {
  const name = input.name.trim()
  if (!name) throw validation('Program name is required.')
  if (input.id) {
    return db.academicProgram.update({
      where: { id: input.id },
      data: { name, code: input.code?.trim() || null },
    })
  }
  try {
    return await db.academicProgram.create({
      data: { orgId: ctx.orgId, name, code: input.code?.trim() || null },
    })
  } catch {
    throw conflict('Another program already uses that name.')
  }
}

export async function listTerms(ctx: OrgContext) {
  return db.academicTerm.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    orderBy: { startsOn: 'desc' },
  })
}

export async function upsertTerm(
  ctx: OrgContext,
  input: { id?: string; name: string; startsOn: string; endsOn: string },
) {
  const name = input.name.trim()
  if (!name) throw validation('Term name is required.')
  const dateError = assertTermDates(input.startsOn, input.endsOn)
  if (dateError) throw validation(dateError)

  const data = {
    name,
    startsOn: toDate(input.startsOn),
    endsOn: toDate(input.endsOn),
  }

  if (input.id) {
    return db.academicTerm.update({ where: { id: input.id }, data })
  }
  try {
    return await db.academicTerm.create({
      data: { orgId: ctx.orgId, ...data },
    })
  } catch {
    throw conflict('Another term already uses that name.')
  }
}

export async function listFeePlans(ctx: OrgContext) {
  return db.feePlan.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    include: {
      program: { select: { id: true, name: true } },
      lines: {
        orderBy: { sortOrder: 'asc' },
        include: { item: { select: { id: true, name: true, salesPrice: true } } },
      },
    },
    orderBy: { name: 'asc' },
  })
}

export async function upsertFeePlan(
  ctx: OrgContext,
  input: {
    id?: string
    name: string
    programId?: string | null
    lines: { itemId: string; description?: string; quantity: string; unitPrice?: string | null }[]
  },
) {
  const name = input.name.trim()
  if (!name) throw validation('Fee plan name is required.')
  if (!input.lines.length) throw validation('Add at least one fee line.')

  if (input.programId) {
    const program = await db.academicProgram.findFirst({
      where: { id: input.programId, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!program) throw notFound('Program')
  }

  const itemIds = [...new Set(input.lines.map((line) => line.itemId))]
  const items = await db.item.findMany({
    where: { orgId: ctx.orgId, id: { in: itemIds }, isActive: true, deletedAt: null },
    select: { id: true },
  })
  if (items.length !== itemIds.length) throw notFound('Fee item')

  const lineRows = input.lines.map((line, index) => {
    const quantity = new Decimal(line.quantity || '1')
    if (quantity.lessThanOrEqualTo(0)) throw validation('Fee quantity must be more than zero.')
    return {
      itemId: line.itemId,
      description: line.description?.trim() || null,
      quantity,
      unitPrice: line.unitPrice?.trim() ? new Decimal(line.unitPrice) : null,
      sortOrder: index,
    }
  })

  if (input.id) {
    const existing = await db.feePlan.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Fee plan')
    return db.$transaction(async (tx) => {
      await tx.feePlanLine.deleteMany({ where: { feePlanId: existing.id } })
      return tx.feePlan.update({
        where: { id: existing.id },
        data: {
          name,
          programId: input.programId || null,
          lines: { create: lineRows },
        },
        include: { lines: true },
      })
    })
  }

  try {
    return await db.feePlan.create({
      data: {
        orgId: ctx.orgId,
        name,
        programId: input.programId || null,
        lines: { create: lineRows },
      },
      include: { lines: true },
    })
  } catch {
    throw conflict('Another fee plan already uses that name.')
  }
}

export async function listEnrollments(ctx: OrgContext, termId?: string) {
  return db.studentEnrollment.findMany({
    where: {
      orgId: ctx.orgId,
      ...(termId ? { termId } : {}),
    },
    include: {
      customer: { select: { id: true, displayName: true } },
      program: { select: { id: true, name: true } },
      term: { select: { id: true, name: true } },
      feePlan: { select: { id: true, name: true } },
      salesDocument: { select: { id: true, number: true, total: true, status: true } },
    },
    orderBy: { enrolledAt: 'desc' },
    take: 500,
  })
}

export async function enrollStudent(
  ctx: OrgContext,
  input: {
    customerId: string
    programId: string
    termId: string
    feePlanId?: string | null
    scholarshipPercent?: string | number
    notes?: string | null
    billNow?: boolean
  },
) {
  const [customer, program, term] = await Promise.all([
    db.customer.findFirst({
      where: { id: input.customerId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    }),
    db.academicProgram.findFirst({
      where: { id: input.programId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    }),
    db.academicTerm.findFirst({
      where: { id: input.termId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    }),
  ])
  if (!customer) throw notFound('Student / customer')
  if (!program) throw notFound('Program')
  if (!term) throw notFound('Term')

  const feePlanId = input.feePlanId || null
  if (feePlanId) {
    const plan = await db.feePlan.findFirst({
      where: { id: feePlanId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!plan) throw notFound('Fee plan')
  }

  const scholarshipPercent = normalizeScholarshipPercent(input.scholarshipPercent)

  let enrollment
  try {
    enrollment = await db.studentEnrollment.create({
      data: {
        orgId: ctx.orgId,
        customerId: customer.id,
        programId: program.id,
        termId: term.id,
        feePlanId,
        scholarshipPercent,
        notes: input.notes?.trim() || null,
      },
    })
  } catch {
    throw conflict('This student is already enrolled in that program for the term.')
  }

  if (input.billNow) {
    return billEnrollment(ctx, enrollment.id)
  }
  return { enrollmentId: enrollment.id, invoiceId: null as string | null, invoiceNumber: null as string | null }
}

export async function billEnrollment(ctx: OrgContext, enrollmentId: string) {
  const enrollment = await db.studentEnrollment.findFirst({
    where: { id: enrollmentId, orgId: ctx.orgId },
    include: {
      feePlan: {
        include: {
          lines: {
            orderBy: { sortOrder: 'asc' },
            include: { item: { select: { id: true, name: true, salesPrice: true } } },
          },
        },
      },
      program: { select: { name: true } },
      term: { select: { name: true } },
      customer: { select: { displayName: true } },
    },
  })
  if (!enrollment) throw notFound('Enrollment')
  if (
    !canBillEnrollment({
      status: enrollment.status as EnrollmentStatus,
      salesDocumentId: enrollment.salesDocumentId,
    })
  ) {
    throw precondition(
      enrollment.salesDocumentId
        ? 'This enrollment already has a fee invoice.'
        : 'Only an active enrollment can be billed.',
    )
  }
  if (!enrollment.feePlan || enrollment.feePlan.lines.length === 0) {
    throw validation('Assign a fee plan with at least one line before billing.')
  }

  const lines = enrollment.feePlan.lines.map((line) => {
    const unitPrice =
      line.unitPrice?.toString() ??
      line.item.salesPrice?.toString() ??
      '0'
    return {
      itemId: line.itemId,
      quantity: line.quantity.toString(),
      unitPrice,
      description:
        line.description?.trim() ||
        `${line.item.name} · ${enrollment.program.name} · ${enrollment.term.name}`,
    }
  })

  const scholarship = normalizeScholarshipPercent(enrollment.scholarshipPercent.toString())

  const invoice = await salesService.create(ctx, 'INVOICE', {
    number: undefined,
    customerId: enrollment.customerId,
    date: today(ctx.organization.timeZone),
    lines,
    saveAsDraft: false,
    acknowledgeCreditLimit: false,
    discountKind: 'percent',
    discountValue: scholarship > 0 ? String(scholarship) : null,
    customerMessage: `Tuition / fees — ${enrollment.program.name} · ${enrollment.term.name}`,
    memo: enrollment.notes ?? undefined,
  })

  const linked = await db.studentEnrollment.updateMany({
    where: { id: enrollment.id, salesDocumentId: null, status: 'ENROLLED' },
    data: { salesDocumentId: invoice.id },
  })
  if (linked.count === 0) {
    await salesService.remove(ctx, invoice.id, 'Enrollment already billed by another request')
    throw conflict('This enrollment was already billed.')
  }

  return {
    enrollmentId: enrollment.id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
  }
}

export async function withdrawEnrollment(ctx: OrgContext, enrollmentId: string) {
  const enrollment = await db.studentEnrollment.findFirst({
    where: { id: enrollmentId, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!enrollment) throw notFound('Enrollment')
  if (!canWithdrawEnrollment(enrollment.status as EnrollmentStatus)) {
    throw precondition('Only an active enrollment can be withdrawn.')
  }
  return db.studentEnrollment.update({
    where: { id: enrollment.id },
    data: { status: 'WITHDRAWN' },
  })
}

export async function termSummary(ctx: OrgContext, termId: string) {
  const term = await db.academicTerm.findFirst({
    where: { id: termId, orgId: ctx.orgId },
    select: { id: true, name: true },
  })
  if (!term) throw notFound('Term')

  const enrollments = await db.studentEnrollment.findMany({
    where: { orgId: ctx.orgId, termId },
    select: {
      status: true,
      salesDocument: { select: { total: true, status: true } },
    },
  })

  const counts = enrollmentCount(enrollments.map((row) => ({ status: row.status as EnrollmentStatus })))
  let feesInvoiced = new Decimal(0)
  for (const row of enrollments) {
    if (row.salesDocument && row.salesDocument.status !== 'VOID') {
      feesInvoiced = feesInvoiced.plus(row.salesDocument.total.toString())
    }
  }

  return {
    term,
    counts,
    feesInvoiced: feesInvoiced.toFixed(2),
  }
}

export async function hubStats(ctx: OrgContext) {
  const [programs, terms, enrollments] = await Promise.all([
    db.academicProgram.count({ where: { orgId: ctx.orgId, isActive: true } }),
    db.academicTerm.count({ where: { orgId: ctx.orgId, isActive: true } }),
    db.studentEnrollment.findMany({
      where: { orgId: ctx.orgId, status: 'ENROLLED' },
      select: { id: true },
      take: 5000,
    }),
  ])
  return {
    programs,
    terms,
    activeEnrollments: enrollments.length,
  }
}
