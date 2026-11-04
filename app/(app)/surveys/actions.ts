'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { parseQuestions } from '@/lib/erp/survey-results'
import { requireOrgContext } from '@/server/auth/context'
import * as collab from '@/server/services/collab.service'

export async function createSurvey(formData: FormData) {
  const ctx = await requireOrgContext('knowledge:create')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const questions = parseQuestions(
    ['q1', 'q2', 'q3'].map((key) => {
      const label = String(formData.get(key) ?? '').trim()
      const typeRaw = String(formData.get(`${key}Type`) ?? 'text')
      return { id: key, label, type: typeRaw }
    }),
  )
  await collab.createSurvey(ctx, { title, description, questions })
  revalidatePath('/surveys')
  redirect('/surveys')
}

export async function submitResponse(formData: FormData) {
  const ctx = await requireOrgContext('knowledge:create')
  const surveyId = String(formData.get('surveyId') ?? '').trim()
  const respondent = String(formData.get('respondent') ?? '').trim() || null
  const answers: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('answer_')) continue
    answers[key.slice('answer_'.length)] = String(value)
  }
  await collab.submitSurveyResponse(ctx, { surveyId, respondent, answers })
  revalidatePath('/surveys')
  redirect('/surveys')
}

export async function closeSurvey(formData: FormData) {
  const ctx = await requireOrgContext('knowledge:create')
  const surveyId = String(formData.get('surveyId') ?? '').trim()
  await collab.closeSurvey(ctx, surveyId)
  revalidatePath('/surveys')
  redirect('/surveys')
}
