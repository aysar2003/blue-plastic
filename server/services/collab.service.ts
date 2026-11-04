import 'server-only'

import { randomBytes } from 'node:crypto'

import {
  canCancelAppointment,
  canCompleteAppointment,
  slotsOverlap,
} from '@/lib/erp/appointment-overlap'
import { canSubmitSurvey, parseQuestions, type SurveyQuestion } from '@/lib/erp/survey-results'
import {
  canCancelSignRequest,
  canDeclineSignRequest,
  canSignRequest,
  publicSignPath,
} from '@/lib/erp/sign-workflow'
import { toDate, type CalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { resolveSiteUrl } from '@/lib/site-url'
import { db } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'
import * as mailService from '@/server/services/mail.service'

function newSignToken() {
  return randomBytes(24).toString('hex')
}

/* --- Sign ----------------------------------------------------------------- */

export async function getSignRequest(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'knowledge:read')
  const row = await db.signRequest.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!row) throw notFound('Sign request')
  return row
}

export async function listSignRequests(ctx: OrgContext) {
  assertPermission(ctx, 'knowledge:read')
  const rows = await db.signRequest.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { updatedAt: 'desc' },
    take: 80,
  })
  return rows.map((row) => ({
    ...row,
    publicPath: row.token ? publicSignPath(row.token) : null,
  }))
}

export async function createSignRequest(
  ctx: OrgContext,
  input: {
    title: string
    signerName?: string | null
    signerEmail?: string | null
    message?: string | null
  },
) {
  assertPermission(ctx, 'knowledge:create')
  const title = input.title.trim()
  if (!title) throw validation('Give the document a title.')
  return db.signRequest.create({
    data: {
      orgId: ctx.orgId,
      title,
      signerName: input.signerName?.trim() || null,
      signerEmail: input.signerEmail?.trim() || null,
      message: input.message?.trim() || null,
      status: 'SENT',
      token: newSignToken(),
    },
    select: { id: true, title: true, token: true, status: true },
  })
}

export async function markSigned(
  ctx: OrgContext,
  input: { id: string; signatureData: string; signerName?: string | null },
) {
  assertPermission(ctx, 'knowledge:create')
  const row = await db.signRequest.findFirst({
    where: { id: input.id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Sign request')
  if (!canSignRequest(row.status)) throw precondition('This request can no longer be signed.')
  if (!input.signatureData.trim()) throw validation('Draw or type a signature.')
  return db.signRequest.update({
    where: { id: row.id },
    data: {
      status: 'SIGNED',
      signatureData: input.signatureData.trim(),
      signerName: input.signerName?.trim() || undefined,
      signedAt: new Date(),
    },
    select: { id: true, status: true },
  })
}

export async function emailSignRequest(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'knowledge:create')
  const row = await db.signRequest.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, title: true, token: true, signerEmail: true, signerName: true, status: true },
  })
  if (!row) throw notFound('Sign request')
  if (!row.token) throw precondition('This request has no signing link.')
  if (!row.signerEmail) throw validation('Add the signer email first.')
  const settings = await mailService.getOutboundSettings(ctx)
  if (!settings.configured) {
    throw precondition('Connect outgoing email in Settings → Organisation.')
  }
  const url = `${resolveSiteUrl().origin}${publicSignPath(row.token)}`
  await mailService.sendOrgMail(ctx, {
    to: row.signerEmail,
    subject: `Please sign: ${row.title}`,
    text: `Hello${row.signerName ? ` ${row.signerName}` : ''},\n\nPlease sign “${row.title}”:\n${url}\n\n${ctx.organization.name}`,
    fromName: ctx.organization.name,
  })
  return { id: row.id, sentTo: row.signerEmail }
}

export async function cancelSignRequest(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'knowledge:create')
  const row = await db.signRequest.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Sign request')
  if (!canCancelSignRequest(row.status)) throw precondition('This request cannot be cancelled.')
  return db.signRequest.update({
    where: { id: row.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
    select: { id: true, status: true },
  })
}

export async function getSignRequestByToken(token: string) {
  const row = await db.signRequest.findFirst({
    where: { token },
    select: {
      id: true,
      title: true,
      status: true,
      message: true,
      signerName: true,
      signerEmail: true,
      signedAt: true,
      organization: { select: { name: true } },
    },
  })
  if (!row) throw notFound('Sign request')
  return row
}

export async function signByToken(input: {
  token: string
  signatureData: string
  signerName?: string | null
}) {
  const row = await db.signRequest.findFirst({
    where: { token: input.token },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Sign request')
  if (!canSignRequest(row.status)) throw precondition('This request can no longer be signed.')
  if (!input.signatureData.trim()) throw validation('Type your name as the signature.')
  return db.signRequest.update({
    where: { id: row.id },
    data: {
      status: 'SIGNED',
      signatureData: input.signatureData.trim(),
      signerName: input.signerName?.trim() || undefined,
      signedAt: new Date(),
    },
    select: { id: true, status: true },
  })
}

export async function declineByToken(input: { token: string; reason?: string | null }) {
  const row = await db.signRequest.findFirst({
    where: { token: input.token },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Sign request')
  if (!canDeclineSignRequest(row.status)) throw precondition('This request cannot be declined.')
  return db.signRequest.update({
    where: { id: row.id },
    data: {
      status: 'DECLINED',
      declinedAt: new Date(),
      declineReason: input.reason?.trim() || null,
    },
    select: { id: true, status: true },
  })
}

/* --- Discuss -------------------------------------------------------------- */

export async function listChannels(ctx: OrgContext) {
  assertPermission(ctx, 'knowledge:read')
  return db.discussChannel.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { messages: true } } },
  })
}

export async function createChannel(ctx: OrgContext, input: { name: string; description?: string | null }) {
  assertPermission(ctx, 'knowledge:create')
  const name = input.name.trim().replace(/^#/, '').toLowerCase()
  if (!name) throw validation('Name the channel.')
  const existing = await db.discussChannel.findFirst({
    where: { orgId: ctx.orgId, name },
    select: { id: true },
  })
  if (existing) throw conflict('A channel with that name already exists.')
  return db.discussChannel.create({
    data: {
      orgId: ctx.orgId,
      name,
      description: input.description?.trim() || null,
    },
    select: { id: true, name: true },
  })
}

export async function postMessage(
  ctx: OrgContext,
  input: { channelId: string; body: string; parentId?: string | null },
) {
  assertPermission(ctx, 'knowledge:create')
  const channel = await db.discussChannel.findFirst({
    where: { id: input.channelId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!channel) throw notFound('Channel')
  const body = input.body.trim()
  if (!body) throw validation('Write a message.')
  let parentId: string | null = null
  if (input.parentId) {
    const parent = await db.discussMessage.findFirst({
      where: { id: input.parentId, orgId: ctx.orgId, channelId: channel.id },
      select: { id: true, parentId: true },
    })
    if (!parent) throw notFound('Message')
    parentId = parent.parentId ?? parent.id
  }
  return db.discussMessage.create({
    data: {
      orgId: ctx.orgId,
      channelId: channel.id,
      authorId: ctx.userId,
      body,
      parentId,
    },
    select: { id: true, createdAt: true },
  })
}

export async function pinMessage(ctx: OrgContext, messageId: string, pinned: boolean) {
  assertPermission(ctx, 'knowledge:create')
  const row = await db.discussMessage.findFirst({
    where: { id: messageId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!row) throw notFound('Message')
  return db.discussMessage.update({
    where: { id: row.id },
    data: { pinnedAt: pinned ? new Date() : null },
    select: { id: true, pinnedAt: true },
  })
}

export async function listMessages(ctx: OrgContext, channelId: string) {
  assertPermission(ctx, 'knowledge:read')
  return db.discussMessage.findMany({
    where: { orgId: ctx.orgId, channelId },
    orderBy: [{ pinnedAt: 'desc' }, { createdAt: 'asc' }],
    take: 200,
    include: { author: { select: { id: true, name: true } } },
  })
}

/* --- Appointments --------------------------------------------------------- */

export async function listAppointments(ctx: OrgContext) {
  assertPermission(ctx, 'calendar:read')
  return db.appointment.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { startsAt: 'asc' },
    take: 80,
    include: {
      type: { select: { name: true, durationMins: true } },
      customer: { select: { id: true, displayName: true } },
    },
  })
}

export async function listAppointmentTypes(ctx: OrgContext) {
  assertPermission(ctx, 'calendar:read')
  return db.appointmentType.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { name: 'asc' },
  })
}

export async function ensureAppointmentType(ctx: OrgContext, name: string, durationMins = 30) {
  assertPermission(ctx, 'calendar:create')
  const existing = await db.appointmentType.findFirst({
    where: { orgId: ctx.orgId, name },
    select: { id: true },
  })
  if (existing) return existing
  return db.appointmentType.create({
    data: { orgId: ctx.orgId, name, durationMins },
    select: { id: true },
  })
}

export async function createAppointmentType(
  ctx: OrgContext,
  input: { name: string; durationMins?: number },
) {
  const name = input.name.trim()
  if (!name) throw validation('Name the appointment type.')
  const durationMins = Math.max(5, Math.min(480, Math.round(Number(input.durationMins) || 30)))
  return ensureAppointmentType(ctx, name, durationMins)
}

export async function bookAppointment(
  ctx: OrgContext,
  input: {
    typeId: string
    startsAt: string
    endsAt: string
    customerId?: string | null
    guestName?: string | null
    guestEmail?: string | null
    notes?: string | null
  },
) {
  assertPermission(ctx, 'calendar:create')
  const type = await db.appointmentType.findFirst({
    where: { id: input.typeId, orgId: ctx.orgId },
    select: { id: true, name: true },
  })
  if (!type) throw notFound('Appointment type')
  const startsAt = new Date(input.startsAt)
  const endsAt = new Date(input.endsAt)
  if (!(endsAt > startsAt)) throw validation('End must be after start.')

  const open = await db.appointment.findMany({
    where: { orgId: ctx.orgId, status: 'BOOKED' },
    select: { startsAt: true, endsAt: true },
    take: 200,
  })
  if (open.some((row) => slotsOverlap(startsAt, endsAt, row.startsAt, row.endsAt))) {
    throw conflict('That slot overlaps an existing booking.')
  }

  const appointment = await db.appointment.create({
    data: {
      orgId: ctx.orgId,
      typeId: type.id,
      status: 'BOOKED',
      startsAt,
      endsAt,
      customerId: input.customerId || null,
      guestName: input.guestName?.trim() || null,
      guestEmail: input.guestEmail?.trim() || null,
      notes: input.notes?.trim() || null,
    },
    select: { id: true },
  })

  try {
    const event = await db.calendarEvent.create({
      data: {
        orgId: ctx.orgId,
        title: type.name,
        startsAt,
        endsAt,
        description: input.notes?.trim() || `Appointment ${appointment.id}`,
        kind: 'appointment',
        createdById: ctx.userId,
        customerId: input.customerId || null,
      },
      select: { id: true },
    })
    await db.appointment.update({
      where: { id: appointment.id },
      data: { calendarEventId: event.id },
    })
  } catch {
    // Calendar write failure must not undo the booking.
  }

  return appointment
}

export async function setAppointmentStatus(
  ctx: OrgContext,
  input: { id: string; status: 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' },
) {
  assertPermission(ctx, 'calendar:create')
  const row = await db.appointment.findFirst({
    where: { id: input.id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Appointment')
  if (input.status === 'COMPLETED' && !canCompleteAppointment(row.status)) {
    throw precondition('Only a booked appointment can be completed.')
  }
  if (input.status === 'CANCELLED' && !canCancelAppointment(row.status)) {
    throw precondition('Only a booked appointment can be cancelled.')
  }
  if (input.status === 'NO_SHOW' && row.status !== 'BOOKED') {
    throw precondition('Only a booked appointment can be marked no-show.')
  }
  return db.appointment.update({
    where: { id: row.id },
    data: { status: input.status },
    select: { id: true, status: true },
  })
}

/* --- Surveys -------------------------------------------------------------- */

export async function listSurveys(ctx: OrgContext) {
  assertPermission(ctx, 'knowledge:read')
  return db.survey.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { responses: true } }, responses: { take: 80 } },
  })
}

export async function createSurvey(
  ctx: OrgContext,
  input: { title: string; description?: string | null; questions: SurveyQuestion[] },
) {
  assertPermission(ctx, 'knowledge:create')
  const questions = parseQuestions(input.questions)
  if (!questions.length) throw validation('Add at least one question.')
  return db.survey.create({
    data: {
      orgId: ctx.orgId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      status: 'OPEN',
      questions,
    },
    select: { id: true, title: true },
  })
}

export async function closeSurvey(ctx: OrgContext, surveyId: string) {
  assertPermission(ctx, 'knowledge:create')
  const survey = await db.survey.findFirst({
    where: { id: surveyId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!survey) throw notFound('Survey')
  return db.survey.update({
    where: { id: survey.id },
    data: { status: 'CLOSED' },
    select: { id: true, status: true },
  })
}

export async function submitSurveyResponse(
  ctx: OrgContext,
  input: { surveyId: string; respondent?: string | null; answers: Record<string, string> },
) {
  assertPermission(ctx, 'knowledge:create')
  const survey = await db.survey.findFirst({
    where: { id: input.surveyId, orgId: ctx.orgId },
    select: { id: true, status: true, questions: true },
  })
  if (!survey) throw notFound('Survey')
  if (!canSubmitSurvey(survey.status)) throw precondition('This survey is closed.')
  const questions = parseQuestions(survey.questions)
  const answers: Record<string, string> = {}
  for (const question of questions) {
    const value = input.answers[question.id]?.trim() ?? ''
    if (value) answers[question.id] = value
  }
  if (Object.keys(answers).length === 0) throw validation('Answer at least one question.')
  return db.surveyResponse.create({
    data: {
      orgId: ctx.orgId,
      surveyId: survey.id,
      respondent: input.respondent?.trim() || null,
      answers,
    },
    select: { id: true },
  })
}

/* --- Planning week grid --------------------------------------------------- */

export async function planningWeek(ctx: OrgContext, weekStart?: CalendarDate) {
  assertPermission(ctx, 'project:read')
  const start = weekStart ? toDate(weekStart) : startOfWeek(new Date())
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)

  const [employees, tasks, time, assignments] = await Promise.all([
    db.employee.findMany({
      where: { orgId: ctx.orgId, lifecycleStatus: 'ACTIVE', active: true },
      select: { id: true, name: true, userId: true },
      orderBy: { name: 'asc' },
      take: 40,
    }),
    db.projectTask.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [{ deadline: { gte: start, lt: end } }, { deadline: null }],
      },
      select: {
        id: true,
        name: true,
        deadline: true,
        assigneeId: true,
        project: { select: { name: true } },
      },
      take: 80,
    }),
    db.projectTimeEntry.findMany({
      where: { orgId: ctx.orgId, workDate: { gte: start, lt: end } },
      select: { id: true, hours: true, userId: true, workDate: true, taskId: true },
      take: 200,
    }),
    db.planningAssignment.findMany({
      where: { orgId: ctx.orgId, workDate: { gte: start, lt: end } },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { workDate: 'asc' },
    }),
  ])

  return { start, end, employees, tasks, time, assignments }
}

export async function assignPlanning(
  ctx: OrgContext,
  input: {
    employeeId: string
    workDate: CalendarDate
    hours: string
    taskId?: string | null
    notes?: string | null
  },
) {
  assertPermission(ctx, 'project:create')
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, orgId: ctx.orgId, active: true },
    select: { id: true },
  })
  if (!employee) throw notFound('Employee')
  const hours = new Decimal(input.hours || 0)
  if (hours.lessThanOrEqualTo(ZERO)) throw validation('Hours must be greater than zero.')
  if (hours.greaterThan(24)) throw validation('Hours cannot exceed 24 in one day.')
  return db.planningAssignment.create({
    data: {
      orgId: ctx.orgId,
      employeeId: employee.id,
      taskId: input.taskId || null,
      workDate: toDate(input.workDate),
      hours: hours.toFixed(4),
      notes: input.notes?.trim() || null,
    },
    select: { id: true },
  })
}

function startOfWeek(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = start.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  start.setUTCDate(start.getUTCDate() + offset)
  return start
}
