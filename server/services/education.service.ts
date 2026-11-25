import 'server-only'

import { Decimal } from '@/lib/money'
import { toDate, today } from '@/lib/date'
import {
  assertTermDates,
  canBillEnrollment,
  canWithdrawEnrollment,
  enrollmentCount,
  feeInvoiceLinesWithWaiver,
  normalizeScholarshipPercent,
  scholarshipDiscountAmount,
  type EnrollmentStatus,
} from '@/lib/erp/education'
import {
  assertEducationRetentionSafe,
  buildNextYearTerms,
  canCloseAcademicYear,
  canCompleteEnrollment,
  canOpenSiblingYear,
  canPromoteEnrollment,
  nextAcademicYearLabel,
} from '@/lib/erp/academic-year-lifecycle'
import { parseCsv } from '@/lib/csv'
import { toCalendarDate } from '@/lib/date'
import { scholarshipSummaryTotals } from '@/lib/erp/scholarship-summary'
import { isAdmissionStatus } from '@/lib/erp/school-ops'
import { sendTextNotification } from '@/lib/notify-gateway'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'
import * as salesService from '@/server/services/sales.service'

async function notifyPhone(phone: string | null | undefined, text: string) {
  if (!phone?.trim()) return { ok: false as const, reason: 'no_phone' as const }
  const wa = await sendTextNotification('whatsapp', phone, text)
  if (wa.ok) return wa
  return sendTextNotification('sms', phone, text)
}

function splitFeeLinesByInstallments(
  lines: { itemId: string; quantity: string; unitPrice: string; description: string }[],
  installmentCount: number,
) {
  const count =
    Number.isInteger(installmentCount) && installmentCount >= 1 && installmentCount <= 6
      ? installmentCount
      : 1
  if (count <= 1) return lines
  const out: { itemId: string; quantity: string; unitPrice: string; description: string }[] = []
  for (const line of lines) {
    const unit = new Decimal(line.unitPrice)
    const each = unit.div(count).toDecimalPlaces(4)
    let allocated = new Decimal(0)
    for (let k = 1; k <= count; k += 1) {
      const part = k === count ? unit.minus(allocated) : each
      if (k < count) allocated = allocated.plus(part)
      out.push({
        ...line,
        unitPrice: part.toFixed(4),
        description: `${line.description} · Installment ${k}/${count}`,
      })
    }
  }
  return out
}

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

export async function listAcademicYears(ctx: OrgContext) {
  return db.academicYear.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { startsOn: 'desc' },
    include: {
      _count: { select: { terms: true } },
    },
  })
}

export async function getOpenAcademicYear(ctx: OrgContext) {
  return db.academicYear.findFirst({
    where: { orgId: ctx.orgId, status: 'OPEN' },
    orderBy: { startsOn: 'desc' },
  })
}

export async function listTerms(
  ctx: OrgContext,
  opts?: { academicYearId?: string; includeInactive?: boolean },
) {
  return db.academicTerm.findMany({
    where: {
      orgId: ctx.orgId,
      ...(opts?.academicYearId ? { academicYearId: opts.academicYearId } : {}),
      ...(opts?.includeInactive ? {} : { isActive: true }),
    },
    include: {
      academicYear: { select: { id: true, label: true, status: true } },
    },
    orderBy: { startsOn: 'desc' },
  })
}

export async function upsertTerm(
  ctx: OrgContext,
  input: {
    id?: string
    name: string
    startsOn: string
    endsOn: string
    academicYearId?: string | null
  },
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
    const existing = await db.academicTerm.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      include: { academicYear: { select: { status: true } } },
    })
    if (!existing) throw notFound('Term')
    if (existing.academicYear.status === 'CLOSED') {
      throw precondition('Closed-year terms are read-only. Open a new school year to change dates.')
    }
    return db.academicTerm.update({ where: { id: input.id }, data })
  }

  let academicYearId = input.academicYearId?.trim() || null
  if (!academicYearId) {
    const open = await getOpenAcademicYear(ctx)
    if (!open) throw validation('Open a school year before adding terms.')
    academicYearId = open.id
  } else {
    const year = await db.academicYear.findFirst({
      where: { id: academicYearId, orgId: ctx.orgId },
      select: { id: true, status: true },
    })
    if (!year) throw notFound('School year')
    if (year.status === 'CLOSED') {
      throw precondition('Cannot add terms to a closed school year.')
    }
  }

  try {
    return await db.academicTerm.create({
      data: { orgId: ctx.orgId, academicYearId, ...data },
    })
  } catch {
    throw conflict('Another term already uses that name.')
  }
}

/**
 * Close a school year: deactivate its terms, complete remaining enrollments.
 * Never deletes education history.
 */
export async function closeAcademicYear(ctx: OrgContext, yearId: string) {
  assertEducationRetentionSafe('close academic year')
  const year = await db.academicYear.findFirst({
    where: { id: yearId, orgId: ctx.orgId },
    include: { terms: { select: { id: true } } },
  })
  if (!year) throw notFound('School year')
  if (!canCloseAcademicYear(year.status)) {
    throw precondition('That school year is already closed.')
  }

  const termIds = year.terms.map((t) => t.id)
  return db.$transaction(async (tx) => {
    await tx.academicYear.update({
      where: { id: year.id },
      data: { status: 'CLOSED' },
    })
    if (termIds.length) {
      await tx.academicTerm.updateMany({
        where: { orgId: ctx.orgId, id: { in: termIds } },
        data: { isActive: false },
      })
      await tx.studentEnrollment.updateMany({
        where: { orgId: ctx.orgId, termId: { in: termIds }, status: 'ENROLLED' },
        data: { status: 'COMPLETED' },
      })
    }
    return tx.academicYear.findUniqueOrThrow({ where: { id: year.id } })
  })
}

/**
 * Open the next school year, cloning term/vacation structure from the latest closed
 * (or provided) year. Does not delete prior years.
 */
export async function openAcademicYear(
  ctx: OrgContext,
  input?: {
    label?: string
    copyFromYearId?: string | null
    cloneFeePlans?: boolean
  },
) {
  assertEducationRetentionSafe('open academic year')
  const openCount = await db.academicYear.count({
    where: { orgId: ctx.orgId, status: 'OPEN' },
  })
  if (!canOpenSiblingYear(openCount)) {
    throw precondition('Close the current school year before opening another.')
  }

  const source =
    (input?.copyFromYearId
      ? await db.academicYear.findFirst({
          where: { id: input.copyFromYearId, orgId: ctx.orgId },
          include: { terms: { orderBy: { startsOn: 'asc' } } },
        })
      : null) ??
    (await db.academicYear.findFirst({
      where: { orgId: ctx.orgId },
      orderBy: { startsOn: 'desc' },
      include: { terms: { orderBy: { startsOn: 'asc' } } },
    }))

  const label = (input?.label?.trim() ||
    (source ? nextAcademicYearLabel(source.label) : String(new Date().getUTCFullYear()))).slice(
    0,
    40,
  )

  const existingLabel = await db.academicYear.findFirst({
    where: { orgId: ctx.orgId, label },
    select: { id: true },
  })
  if (existingLabel) throw conflict('A school year with that label already exists.')

  const template = source
    ? source.terms.map((t) => ({
        name: t.name,
        startsOn: toCalendarDate(t.startsOn),
        endsOn: toCalendarDate(t.endsOn),
      }))
    : []
  const nextTerms = source
    ? buildNextYearTerms(template, source.label, label)
    : [
        {
          name: `${label} Term 1`,
          startsOn: `${label.match(/\d{4}/)?.[0] ?? new Date().getUTCFullYear()}-01-15`,
          endsOn: `${label.match(/\d{4}/)?.[0] ?? new Date().getUTCFullYear()}-05-31`,
        },
        {
          name: `${label} Term 2`,
          startsOn: `${label.match(/\d{4}/)?.[0] ?? new Date().getUTCFullYear()}-08-01`,
          endsOn: `${label.match(/\d{4}/)?.[0] ?? new Date().getUTCFullYear()}-11-30`,
        },
      ]

  for (const term of nextTerms) {
    const err = assertTermDates(term.startsOn, term.endsOn)
    if (err) throw validation(err)
  }

  const yearStarts = nextTerms.reduce(
    (min, t) => (t.startsOn < min ? t.startsOn : min),
    nextTerms[0]!.startsOn,
  )
  const yearEnds = nextTerms.reduce(
    (max, t) => (t.endsOn > max ? t.endsOn : max),
    nextTerms[0]!.endsOn,
  )

  const created = await db.$transaction(async (tx) => {
    const year = await tx.academicYear.create({
      data: {
        orgId: ctx.orgId,
        label,
        startsOn: toDate(yearStarts),
        endsOn: toDate(yearEnds),
        status: 'OPEN',
      },
    })
    for (const term of nextTerms) {
      await tx.academicTerm.create({
        data: {
          orgId: ctx.orgId,
          academicYearId: year.id,
          name: term.name,
          startsOn: toDate(term.startsOn),
          endsOn: toDate(term.endsOn),
          isActive: true,
        },
      })
    }

    if (input?.cloneFeePlans) {
      const plans = await tx.feePlan.findMany({
        where: { orgId: ctx.orgId, isActive: true },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      })
      for (const plan of plans) {
        const newName = `${label} · ${plan.name}`.slice(0, 200)
        const clash = await tx.feePlan.findFirst({
          where: { orgId: ctx.orgId, name: newName },
          select: { id: true },
        })
        if (clash) continue
        await tx.feePlan.create({
          data: {
            orgId: ctx.orgId,
            programId: plan.programId,
            name: newName,
            installmentCount: plan.installmentCount,
            lines: {
              create: plan.lines.map((line, index) => ({
                itemId: line.itemId,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                sortOrder: line.sortOrder ?? index,
              })),
            },
          },
        })
      }
    }

    return year
  })

  return created
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
    installmentCount?: number
    lines: { itemId: string; description?: string; quantity: string; unitPrice?: string | null }[]
  },
) {
  const name = input.name.trim()
  if (!name) throw validation('Fee plan name is required.')
  if (!input.lines.length) throw validation('Add at least one fee line.')
  const installmentCount = input.installmentCount ?? 1
  if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 6) {
    throw validation('Installment count must be between 1 and 6.')
  }

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
          installmentCount,
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
        installmentCount,
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
    billingCustomerId?: string | null
    campusId?: string | null
    admissionNumber?: string | null
    dateOfBirth?: string | null
    gender?: string | null
    guardianName?: string | null
    guardianPhone?: string | null
    photoUrl?: string | null
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
  if (input.billingCustomerId) {
    const billTo = await db.customer.findFirst({
      where: { id: input.billingCustomerId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!billTo) throw notFound('Billing customer')
  }
  if (input.campusId) {
    const campus = await db.schoolCampus.findFirst({
      where: { id: input.campusId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!campus) throw notFound('Campus')
  }

  const scholarshipPercent = normalizeScholarshipPercent(input.scholarshipPercent)
  const admissionNumber = input.admissionNumber?.trim() || null

  let enrollment
  try {
    enrollment = await db.studentEnrollment.create({
      data: {
        orgId: ctx.orgId,
        customerId: customer.id,
        billingCustomerId: input.billingCustomerId || null,
        programId: program.id,
        termId: term.id,
        feePlanId,
        campusId: input.campusId || null,
        admissionNumber,
        dateOfBirth: input.dateOfBirth ? toDate(input.dateOfBirth.slice(0, 10)) : null,
        gender: input.gender?.trim() || null,
        guardianName: input.guardianName?.trim() || null,
        guardianPhone: input.guardianPhone?.trim() || null,
        photoUrl: input.photoUrl?.trim() || null,
        scholarshipPercent,
        notes: input.notes?.trim() || null,
      },
    })
  } catch {
    throw conflict('This student is already enrolled in that program for the term (or admission number is taken).')
  }

  if (input.billNow) {
    return billEnrollment(ctx, enrollment.id)
  }
  return { enrollmentId: enrollment.id, invoiceId: null as string | null, invoiceNumber: null as string | null }
}

export async function updateEnrollmentProfile(
  ctx: OrgContext,
  input: {
    enrollmentId: string
    billingCustomerId?: string | null
    campusId?: string | null
    admissionNumber?: string | null
    dateOfBirth?: string | null
    gender?: string | null
    guardianName?: string | null
    guardianPhone?: string | null
    photoUrl?: string | null
    notes?: string | null
  },
) {
  const enrollment = await db.studentEnrollment.findFirst({
    where: { id: input.enrollmentId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!enrollment) throw notFound('Enrollment')
  try {
    return await db.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        billingCustomerId: input.billingCustomerId || null,
        campusId: input.campusId || null,
        admissionNumber: input.admissionNumber?.trim() || null,
        dateOfBirth: input.dateOfBirth ? toDate(input.dateOfBirth.slice(0, 10)) : null,
        gender: input.gender?.trim() || null,
        guardianName: input.guardianName?.trim() || null,
        guardianPhone: input.guardianPhone?.trim() || null,
        photoUrl: input.photoUrl?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    })
  } catch {
    throw conflict('Admission number is already in use.')
  }
}

export async function listAdmissions(ctx: OrgContext, status?: string) {
  return db.schoolAdmission.findMany({
    where: {
      orgId: ctx.orgId,
      ...(status && isAdmissionStatus(status) ? { status } : {}),
    },
    include: {
      program: { select: { id: true, name: true } },
      term: { select: { id: true, name: true } },
      feePlan: { select: { id: true, name: true } },
      customer: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
}

export async function createAdmission(
  ctx: OrgContext,
  input: {
    applicantName: string
    phone?: string | null
    email?: string | null
    programId?: string | null
    termId?: string | null
    feePlanId?: string | null
    notes?: string | null
    status?: string
  },
) {
  const applicantName = input.applicantName.trim()
  if (!applicantName) throw validation('Applicant name is required.')
  const status = input.status || 'APPLIED'
  if (!isAdmissionStatus(status)) throw validation('Invalid admission status.')
  return db.schoolAdmission.create({
    data: {
      orgId: ctx.orgId,
      applicantName,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      programId: input.programId || null,
      termId: input.termId || null,
      feePlanId: input.feePlanId || null,
      notes: input.notes?.trim() || null,
      status,
    },
  })
}

export async function updateAdmissionStatus(
  ctx: OrgContext,
  input: { admissionId: string; status: string },
) {
  if (!isAdmissionStatus(input.status)) throw validation('Invalid admission status.')
  const row = await db.schoolAdmission.findFirst({
    where: { id: input.admissionId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!row) throw notFound('Admission')
  return db.schoolAdmission.update({
    where: { id: row.id },
    data: { status: input.status },
  })
}

/** Accept admission → ensure customer + enroll (optionally bill). */
export async function acceptAdmission(
  ctx: OrgContext,
  input: { admissionId: string; billNow?: boolean; admissionNumber?: string | null },
) {
  const admission = await db.schoolAdmission.findFirst({
    where: { id: input.admissionId, orgId: ctx.orgId },
  })
  if (!admission) throw notFound('Admission')
  if (admission.status === 'ENROLLED') throw precondition('Already enrolled.')
  if (admission.status === 'REJECTED') throw precondition('Rejected applications cannot be enrolled.')
  if (!admission.programId || !admission.termId) {
    throw validation('Set program and term before accepting.')
  }

  let customerId = admission.customerId
  if (!customerId) {
    const created = await db.customer.create({
      data: {
        orgId: ctx.orgId,
        displayName: admission.applicantName,
        phone: admission.phone,
        email: admission.email,
        isActive: true,
      },
    })
    customerId = created.id
    await db.schoolAdmission.update({
      where: { id: admission.id },
      data: { customerId },
    })
  }

  const enrolled = await enrollStudent(ctx, {
    customerId,
    programId: admission.programId,
    termId: admission.termId,
    feePlanId: admission.feePlanId,
    admissionNumber: input.admissionNumber,
    guardianPhone: admission.phone,
    billNow: input.billNow,
  })

  await db.schoolAdmission.update({
    where: { id: admission.id },
    data: { status: 'ENROLLED', customerId },
  })

  return enrolled
}

export async function rejectAdmission(ctx: OrgContext, admissionId: string) {
  return updateAdmissionStatus(ctx, { admissionId, status: 'REJECTED' })
}

export async function sendFeeReminders(ctx: OrgContext, termId?: string) {
  const enrollments = await db.studentEnrollment.findMany({
    where: {
      orgId: ctx.orgId,
      status: 'ENROLLED',
      salesDocumentId: { not: null },
      ...(termId ? { termId } : {}),
      salesDocument: { status: { in: ['OPEN', 'PARTIAL'] }, deletedAt: null },
    },
    include: {
      customer: { select: { displayName: true, phone: true, mobile: true } },
      salesDocument: { select: { id: true, number: true } },
      term: { select: { name: true } },
    },
    take: 500,
  })
  const docIds = enrollments
    .map((row) => row.salesDocument?.id)
    .filter((id): id is string => Boolean(id))
  const balances = await salesService.outstandingBalances(db, docIds, ctx.orgId)
  let sent = 0
  let skipped = 0
  for (const enrollment of enrollments) {
    if (!enrollment.salesDocument) {
      skipped += 1
      continue
    }
    const due = balances.get(enrollment.salesDocument.id) ?? new Decimal(0)
    if (due.lte(0)) {
      skipped += 1
      continue
    }
    const phone =
      enrollment.guardianPhone ||
      enrollment.customer.mobile ||
      enrollment.customer.phone
    const result = await notifyPhone(
      phone,
      `Fee reminder: ${enrollment.customer.displayName} has ${due.toFixed(2)} ${ctx.organization.baseCurrency} open on ${enrollment.salesDocument.number} (${enrollment.term.name}).`,
    )
    if (result.ok) sent += 1
    else skipped += 1
  }
  return { sent, skipped }
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
      transportRiders: {
        include: {
          route: {
            include: { feeItem: { select: { id: true, name: true, salesPrice: true } } },
          },
        },
      },
      hostelAllocations: {
        where: { checkedOutAt: null },
        include: {
          room: {
            include: {
              block: {
                include: { feeItem: { select: { id: true, name: true, salesPrice: true } } },
              },
            },
          },
        },
      },
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

  let lines = enrollment.feePlan.lines.map((line) => {
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

  for (const rider of enrollment.transportRiders) {
    const item = rider.route.feeItem
    if (!item) continue
    lines.push({
      itemId: item.id,
      quantity: '1',
      unitPrice: item.salesPrice?.toString() ?? '0',
      description: `Transport · ${rider.route.name}`,
    })
  }
  for (const allocation of enrollment.hostelAllocations) {
    const item = allocation.room.block.feeItem
    if (!item) continue
    lines.push({
      itemId: item.id,
      quantity: '1',
      unitPrice: item.salesPrice?.toString() ?? '0',
      description: `Hostel · ${allocation.room.block.name} / ${allocation.room.name}`,
    })
  }

  lines = splitFeeLinesByInstallments(lines, enrollment.feePlan.installmentCount)

  const scholarship = normalizeScholarshipPercent(enrollment.scholarshipPercent.toString())
  const feeSubtotal = lines.reduce((sum, line) => {
    return sum.plus(new Decimal(line.unitPrice).times(line.quantity || '1'))
  }, new Decimal(0))
  const waiverAmount = scholarshipDiscountAmount(feeSubtotal.toString(), scholarship)
  const waiverItem = scholarship > 0 ? await ensureScholarshipWaiverItem(ctx) : null
  const invoiceLines = waiverItem
    ? feeInvoiceLinesWithWaiver(lines, {
        itemId: waiverItem.id,
        amount: waiverAmount,
        description: `Scholarship waiver ${scholarship}% · ${enrollment.term.name}`,
      })
    : lines

  const billToCustomerId = enrollment.billingCustomerId || enrollment.customerId

  const invoice = await salesService.create(ctx, 'INVOICE', {
    number: undefined,
    customerId: billToCustomerId,
    date: today(ctx.organization.timeZone),
    lines: invoiceLines,
    saveAsDraft: false,
    acknowledgeCreditLimit: false,
    discountKind: 'percent',
    discountValue: null,
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

/** Bill every active, unbilled enrollment for a term (skips failures individually). */
export async function billTermEnrollments(ctx: OrgContext, termId: string) {
  const term = await db.academicTerm.findFirst({
    where: { id: termId, orgId: ctx.orgId },
    select: { id: true, name: true },
  })
  if (!term) throw notFound('Term')

  const enrollments = await db.studentEnrollment.findMany({
    where: {
      orgId: ctx.orgId,
      termId: term.id,
      status: 'ENROLLED',
      salesDocumentId: null,
      feePlanId: { not: null },
    },
    select: { id: true },
    take: 500,
  })

  const billed: { enrollmentId: string; invoiceId: string; invoiceNumber: string }[] = []
  const errors: { enrollmentId: string; message: string }[] = []

  for (const enrollment of enrollments) {
    try {
      const result = await billEnrollment(ctx, enrollment.id)
      billed.push({
        enrollmentId: result.enrollmentId,
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
      })
    } catch (error) {
      errors.push({
        enrollmentId: enrollment.id,
        message: error instanceof Error ? error.message : 'Billing failed',
      })
    }
  }

  return {
    termId: term.id,
    termName: term.name,
    attempted: enrollments.length,
    billedCount: billed.length,
    billed,
    errors,
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

/** Fees outstanding grouped by academic term (open invoice balances). */
export async function feesOutstandingByTerm(ctx: OrgContext) {
  const enrollments = await db.studentEnrollment.findMany({
    where: {
      orgId: ctx.orgId,
      salesDocumentId: { not: null },
      salesDocument: { status: { in: ['OPEN', 'PARTIAL'] }, deletedAt: null },
    },
    select: {
      term: { select: { id: true, name: true } },
      salesDocument: { select: { id: true, total: true, number: true } },
      customer: { select: { displayName: true } },
    },
    take: 2000,
  })

  const docIds = [
    ...new Set(
      enrollments
        .map((row) => row.salesDocument?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const balances = await salesService.outstandingBalances(db, docIds, ctx.orgId)

  const byTerm = new Map<
    string,
    {
      termId: string
      termName: string
      invoiceCount: number
      outstanding: Decimal
      enrollmentCount: number
    }
  >()

  for (const row of enrollments) {
    if (!row.salesDocument || !row.term) continue
    const balance = balances.get(row.salesDocument.id) ?? new Decimal(0)
    if (balance.lte(0)) continue
    const existing = byTerm.get(row.term.id) ?? {
      termId: row.term.id,
      termName: row.term.name,
      invoiceCount: 0,
      outstanding: new Decimal(0),
      enrollmentCount: 0,
    }
    existing.invoiceCount += 1
    existing.enrollmentCount += 1
    existing.outstanding = existing.outstanding.plus(balance)
    byTerm.set(row.term.id, existing)
  }

  return [...byTerm.values()]
    .map((row) => ({
      termId: row.termId,
      termName: row.termName,
      invoiceCount: row.invoiceCount,
      enrollmentCount: row.enrollmentCount,
      outstanding: row.outstanding.toFixed(2),
    }))
    .sort((a, b) => a.termName.localeCompare(b.termName))
}

/** Phase 48: enrollment counts and scholarship gross / waived / net for a term. */
export async function scholarshipSummary(ctx: OrgContext, termId: string) {
  const term = await db.academicTerm.findFirst({
    where: { id: termId, orgId: ctx.orgId },
    select: { id: true, name: true },
  })
  if (!term) throw notFound('Term')

  const enrollments = await db.studentEnrollment.findMany({
    where: { orgId: ctx.orgId, termId },
    select: {
      status: true,
      scholarshipPercent: true,
      feePlan: {
        select: {
          lines: {
            select: { quantity: true, unitPrice: true, item: { select: { salesPrice: true } } },
          },
        },
      },
    },
  })

  const rows = enrollments.map((row) => {
    let subtotal = new Decimal(0)
    for (const line of row.feePlan?.lines ?? []) {
      const price =
        line.unitPrice != null
          ? new Decimal(line.unitPrice.toString())
          : new Decimal(line.item.salesPrice?.toString() ?? '0')
      subtotal = subtotal.plus(price.times(line.quantity.toString()))
    }
    return {
      status: row.status,
      feeSubtotal: subtotal.toFixed(4),
      scholarshipPercent: row.scholarshipPercent.toString(),
    }
  })

  return { term, ...scholarshipSummaryTotals(rows) }
}

/** Scholarship blocks for every active term (export / CSV). */
export async function scholarshipSummaryForTerms(ctx: OrgContext) {
  const terms = await listTerms(ctx)
  return Promise.all(terms.map((term) => scholarshipSummary(ctx, term.id)))
}

const SCHOLARSHIP_WAIVER_SKU = 'SCH-WAIVER'

async function ensureScholarshipWaiverItem(ctx: OrgContext) {
  const existing = await db.item.findFirst({
    where: {
      orgId: ctx.orgId,
      deletedAt: null,
      OR: [{ sku: SCHOLARSHIP_WAIVER_SKU }, { name: 'Scholarship waiver', type: 'DISCOUNT' }],
    },
    select: { id: true },
  })
  if (existing) return existing

  const income = await db.ledgerAccount.findFirst({
    where: { orgId: ctx.orgId, isActive: true, subtype: 'SALES_DISCOUNTS' },
    select: { id: true },
    orderBy: { code: 'asc' },
  })
  if (!income) throw precondition('Sales Discounts account is missing, so a fee waiver cannot post.')

  try {
    return await db.item.create({
      data: {
        orgId: ctx.orgId,
        name: 'Scholarship waiver',
        sku: SCHOLARSHIP_WAIVER_SKU,
        type: 'DISCOUNT',
        incomeAccountId: income.id,
        isTaxable: false,
        availableInPos: false,
      },
      select: { id: true },
    })
  } catch {
    const raced = await db.item.findFirst({
      where: { orgId: ctx.orgId, sku: SCHOLARSHIP_WAIVER_SKU, deletedAt: null },
      select: { id: true },
    })
    if (raced) return raced
    throw conflict('Scholarship waiver item could not be created.')
  }
}

/** Record an award percent; the fee-waiver line is applied when the term invoice is billed. */
export async function awardScholarship(
  ctx: OrgContext,
  input: { enrollmentId: string; percent: string | number },
) {
  const enrollment = await db.studentEnrollment.findFirst({
    where: { id: input.enrollmentId, orgId: ctx.orgId },
    select: { id: true, salesDocumentId: true },
  })
  if (!enrollment) throw notFound('Enrollment')
  const scholarshipPercent = normalizeScholarshipPercent(input.percent)
  return db.studentEnrollment.update({
    where: { id: enrollment.id },
    data: { scholarshipPercent },
    select: { id: true, scholarshipPercent: true, salesDocumentId: true },
  })
}

export async function completeEnrollment(ctx: OrgContext, enrollmentId: string) {
  assertEducationRetentionSafe('complete enrollment')
  const enrollment = await db.studentEnrollment.findFirst({
    where: { id: enrollmentId, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!enrollment) throw notFound('Enrollment')
  if (!canCompleteEnrollment(enrollment.status)) {
    throw precondition('Only an active enrollment can be marked completed.')
  }
  return db.studentEnrollment.update({
    where: { id: enrollment.id },
    data: { status: 'COMPLETED' },
  })
}

/**
 * Re-enroll students from a closed (or prior) year into a target term on the OPEN year.
 * Prior enrollment rows stay forever.
 */
export async function promoteEnrollments(
  ctx: OrgContext,
  input: {
    fromYearId: string
    toTermId: string
    enrollmentIds?: string[]
    cloneClasses?: boolean
  },
) {
  assertEducationRetentionSafe('promote enrollments')
  const [fromYear, toTerm] = await Promise.all([
    db.academicYear.findFirst({
      where: { id: input.fromYearId, orgId: ctx.orgId },
      include: { terms: { select: { id: true } } },
    }),
    db.academicTerm.findFirst({
      where: { id: input.toTermId, orgId: ctx.orgId },
      include: { academicYear: { select: { id: true, status: true } } },
    }),
  ])
  if (!fromYear) throw notFound('Source school year')
  if (!toTerm) throw notFound('Target term')
  if (toTerm.academicYear.status !== 'OPEN') {
    throw precondition('Promote only into a term on the open school year.')
  }

  const fromTermIds = fromYear.terms.map((t) => t.id)
  if (!fromTermIds.length) return { created: 0, skipped: 0 }

  const source = await db.studentEnrollment.findMany({
    where: {
      orgId: ctx.orgId,
      termId: { in: fromTermIds },
      ...(input.enrollmentIds?.length ? { id: { in: input.enrollmentIds } } : {}),
      status: { in: ['ENROLLED', 'COMPLETED'] },
    },
    include: {
      classMembers: { select: { classId: true, schoolClass: { select: { name: true, code: true, teacherName: true, programId: true } } } },
    },
    take: 5000,
  })

  let created = 0
  let skipped = 0
  const classMap = new Map<string, string>()

  for (const row of source) {
    if (!canPromoteEnrollment(row.status)) {
      skipped += 1
      continue
    }
    const exists = await db.studentEnrollment.findFirst({
      where: {
        orgId: ctx.orgId,
        customerId: row.customerId,
        programId: row.programId,
        termId: toTerm.id,
      },
      select: { id: true },
    })
    if (exists) {
      skipped += 1
      continue
    }

    if (row.status === 'ENROLLED') {
      await db.studentEnrollment.update({
        where: { id: row.id },
        data: { status: 'COMPLETED' },
      })
    }

    const enrollment = await db.studentEnrollment.create({
      data: {
        orgId: ctx.orgId,
        customerId: row.customerId,
        programId: row.programId,
        termId: toTerm.id,
        feePlanId: row.feePlanId,
        scholarshipPercent: row.scholarshipPercent,
        notes: row.notes,
        status: 'ENROLLED',
      },
    })
    created += 1

    if (input.cloneClasses) {
      for (const member of row.classMembers) {
        const sourceClass = member.schoolClass
        let newClassId = classMap.get(member.classId)
        if (!newClassId) {
          const className = sourceClass.name
          const existingClass = await db.schoolClass.findFirst({
            where: { orgId: ctx.orgId, termId: toTerm.id, name: className },
            select: { id: true },
          })
          if (existingClass) {
            newClassId = existingClass.id
          } else {
            const createdClass = await db.schoolClass.create({
              data: {
                orgId: ctx.orgId,
                programId: sourceClass.programId,
                termId: toTerm.id,
                name: className,
                code: sourceClass.code,
                teacherName: sourceClass.teacherName,
              },
              select: { id: true },
            })
            newClassId = createdClass.id
          }
          classMap.set(member.classId, newClassId)
        }
        await db.schoolClassMember.create({
          data: {
            orgId: ctx.orgId,
            classId: newClassId,
            enrollmentId: enrollment.id,
          },
        }).catch(() => undefined)
      }
    }
  }

  return { created, skipped }
}

/** Full student history across all school years (retained forever). */
export async function studentHistory(ctx: OrgContext, customerId: string) {
  const customer = await db.customer.findFirst({
    where: { id: customerId, orgId: ctx.orgId },
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
      mobile: true,
      notes: true,
    },
  })
  if (!customer) throw notFound('Student')

  const enrollments = await db.studentEnrollment.findMany({
    where: { orgId: ctx.orgId, customerId },
    include: {
      program: { select: { id: true, name: true } },
      term: {
        select: {
          id: true,
          name: true,
          startsOn: true,
          endsOn: true,
          academicYear: { select: { id: true, label: true, status: true } },
        },
      },
      feePlan: { select: { id: true, name: true } },
      salesDocument: {
        select: { id: true, number: true, total: true, status: true },
      },
      attendanceDays: {
        select: { onDate: true, mark: true },
        orderBy: { onDate: 'desc' },
        take: 40,
      },
      gradeEntries: {
        select: {
          score: true,
          gradeItem: { select: { name: true, maxScore: true } },
        },
        take: 40,
      },
      classMembers: {
        select: { schoolClass: { select: { name: true } } },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  })

  return { customer, enrollments }
}

/**
 * Import students (customers) + optional prior-year enrollments from CSV.
 * Idempotent by studentCode (stored in notes), email, phone/mobile, or displayName.
 * Never overwrites posted fee invoices.
 */
export async function importStudentsCsv(ctx: OrgContext, csv: string) {
  assertEducationRetentionSafe('import students csv')
  const { rows } = parseCsv(csv)
  if (!rows.length) throw validation('CSV has no data rows.')

  let createdStudents = 0
  let updatedStudents = 0
  let createdEnrollments = 0
  let skippedEnrollments = 0
  const errors: string[] = []

  for (const [index, row] of rows.entries()) {
    const line = index + 2
    const displayName = (row.displayname || row.name || row.studentname || '').trim()
    const email = (row.email || '').trim().toLowerCase() || null
    const phone = (row.phone || row.mobile || '').trim() || null
    const studentCode = (row.studentcode || row.code || '').trim() || null
    const programName = (row.program || row.programname || '').trim()
    const termName = (row.term || row.termname || '').trim()
    const yearLabel = (row.year || row.schoolyear || row.academicyear || '').trim()

    if (!displayName && !email && !phone && !studentCode) {
      errors.push(`Line ${line}: need displayName, email, phone, or studentCode.`)
      continue
    }

    let customer =
      (studentCode
        ? await db.customer.findFirst({
            where: { orgId: ctx.orgId, notes: studentCode, isActive: true },
            select: { id: true },
          })
        : null) ??
      (email
        ? await db.customer.findFirst({
            where: { orgId: ctx.orgId, email, isActive: true },
            select: { id: true },
          })
        : null) ??
      (phone
        ? await db.customer.findFirst({
            where: {
              orgId: ctx.orgId,
              isActive: true,
              OR: [{ phone }, { mobile: phone }],
            },
            select: { id: true },
          })
        : null) ??
      (displayName
        ? await db.customer.findFirst({
            where: { orgId: ctx.orgId, displayName, isActive: true },
            select: { id: true },
          })
        : null)

    if (!customer) {
      if (!displayName) {
        errors.push(`Line ${line}: new student needs a displayName.`)
        continue
      }
      try {
        customer = await db.customer.create({
          data: {
            orgId: ctx.orgId,
            displayName,
            email,
            phone,
            mobile: phone,
            notes: studentCode,
          },
          select: { id: true },
        })
        createdStudents += 1
      } catch {
        errors.push(`Line ${line}: could not create student ${displayName}.`)
        continue
      }
    } else {
      updatedStudents += 1
    }

    if (!termName && !programName) continue

    let programId: string | null = null
    if (programName) {
      let program = await db.academicProgram.findFirst({
        where: { orgId: ctx.orgId, name: programName },
        select: { id: true },
      })
      if (!program) {
        program = await db.academicProgram.create({
          data: { orgId: ctx.orgId, name: programName },
          select: { id: true },
        })
      }
      programId = program.id
    } else {
      const fallback = await db.academicProgram.findFirst({
        where: { orgId: ctx.orgId, isActive: true },
        select: { id: true },
        orderBy: { name: 'asc' },
      })
      programId = fallback?.id ?? null
    }
    if (!programId) {
      errors.push(`Line ${line}: no program available for enrollment.`)
      continue
    }

    let term = termName
      ? await db.academicTerm.findFirst({
          where: { orgId: ctx.orgId, name: termName },
          select: { id: true },
        })
      : null

    if (!term && termName && yearLabel) {
      let year = await db.academicYear.findFirst({
        where: { orgId: ctx.orgId, label: yearLabel },
        select: { id: true },
      })
      if (!year) {
        const y = yearLabel.match(/\d{4}/)?.[0] ?? String(new Date().getUTCFullYear())
        year = await db.academicYear.create({
          data: {
            orgId: ctx.orgId,
            label: yearLabel,
            startsOn: toDate(`${y}-01-01`),
            endsOn: toDate(`${y}-12-31`),
            status: 'CLOSED',
          },
          select: { id: true },
        })
      }
      term = await db.academicTerm.create({
        data: {
          orgId: ctx.orgId,
          academicYearId: year.id,
          name: termName,
          startsOn: toDate(`${yearLabel.match(/\d{4}/)?.[0] ?? '2020'}-01-01`),
          endsOn: toDate(`${yearLabel.match(/\d{4}/)?.[0] ?? '2020'}-12-31`),
          isActive: false,
        },
        select: { id: true },
      })
    }

    if (!term) {
      errors.push(`Line ${line}: term "${termName}" not found (add year column for prior years).`)
      continue
    }

    const exists = await db.studentEnrollment.findFirst({
      where: {
        orgId: ctx.orgId,
        customerId: customer.id,
        programId,
        termId: term.id,
      },
      select: { id: true, salesDocumentId: true },
    })
    if (exists) {
      skippedEnrollments += 1
      continue
    }

    await db.studentEnrollment.create({
      data: {
        orgId: ctx.orgId,
        customerId: customer.id,
        programId,
        termId: term.id,
        status: 'COMPLETED',
      },
    })
    createdEnrollments += 1
  }

  return {
    createdStudents,
    updatedStudents,
    createdEnrollments,
    skippedEnrollments,
    errors,
  }
}
