'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isCalendarDate, toDate } from '@/lib/date'
import { Decimal } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export async function createBudget(formData: FormData) {
  const ctx = await requireOrgContext('report:read')
  const name = String(formData.get('name') ?? '').trim()
  const startDate = String(formData.get('startDate') ?? '')
  const endDate = String(formData.get('endDate') ?? '')
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!name || !isCalendarDate(startDate) || !isCalendarDate(endDate) || startDate > endDate) {
    throw new Error('Name and a valid date range are required.')
  }

  const budget = await db.budget.create({
    data: {
      orgId: ctx.orgId,
      name,
      startDate: toDate(startDate),
      endDate: toDate(endDate),
      notes,
    },
  })

  revalidatePath('/accounting/budgets')
  revalidatePath('/reports/budget-vs-actual')
  redirect(`/accounting/budgets/${budget.id}`)
}

export async function upsertBudgetLine(formData: FormData) {
  const ctx = await requireOrgContext('report:read')
  const budgetId = String(formData.get('budgetId') ?? '')
  const accountId = String(formData.get('accountId') ?? '')
  const amountRaw = String(formData.get('amount') ?? '').trim()

  if (!budgetId || !accountId || !amountRaw) {
    throw new Error('Account and amount are required.')
  }

  const amount = new Decimal(amountRaw)
  if (!amount.isFinite()) throw new Error('Amount must be a number.')

  const budget = await db.budget.findFirst({
    where: { id: budgetId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!budget) throw new Error('Budget not found.')

  const account = await db.ledgerAccount.findFirst({
    where: { id: accountId, orgId: ctx.orgId, isActive: true },
    select: { id: true },
  })
  if (!account) throw new Error('Account not found.')

  await db.budgetLine.upsert({
    where: { budgetId_accountId: { budgetId, accountId } },
    create: {
      orgId: ctx.orgId,
      budgetId,
      accountId,
      amount: amount.toFixed(4),
    },
    update: { amount: amount.toFixed(4) },
  })

  revalidatePath(`/accounting/budgets/${budgetId}`)
  revalidatePath('/reports/budget-vs-actual')
}

export async function deleteBudgetLine(formData: FormData) {
  const ctx = await requireOrgContext('report:read')
  const lineId = String(formData.get('lineId') ?? '')
  const line = await db.budgetLine.findFirst({
    where: { id: lineId, orgId: ctx.orgId },
    select: { id: true, budgetId: true },
  })
  if (!line) return
  await db.budgetLine.delete({ where: { id: line.id } })
  revalidatePath(`/accounting/budgets/${line.budgetId}`)
  revalidatePath('/reports/budget-vs-actual')
}
