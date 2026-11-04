export type SurveyQuestion = {
  id: string
  label: string
  type: 'text' | 'choice' | 'score'
  options?: string[]
}

export type SurveyAnswerMap = Record<string, string>

export type QuestionTally = {
  id: string
  label: string
  type: SurveyQuestion['type']
  responseCount: number
  counts: Record<string, number>
  averageScore: number | null
}

export function parseQuestions(raw: unknown): SurveyQuestion[] {
  if (!Array.isArray(raw)) return []
  const out: SurveyQuestion[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const data = row as Record<string, unknown>
    const id = typeof data.id === 'string' ? data.id.trim() : ''
    const label = typeof data.label === 'string' ? data.label.trim() : ''
    if (!id || !label) continue
    const type = data.type === 'choice' || data.type === 'score' ? data.type : 'text'
    const options = Array.isArray(data.options)
      ? data.options.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
      : undefined
    out.push({ id, label, type, options })
  }
  return out
}

export function aggregateSurvey(
  questions: SurveyQuestion[],
  responses: { answers: unknown }[],
): QuestionTally[] {
  return questions.map((question) => {
    const counts: Record<string, number> = {}
    let numericSum = 0
    let numericN = 0
    let responseCount = 0
    for (const response of responses) {
      const answers =
        response.answers && typeof response.answers === 'object' && !Array.isArray(response.answers)
          ? (response.answers as SurveyAnswerMap)
          : {}
      const value = answers[question.id]
      if (value == null || String(value).trim() === '') continue
      responseCount += 1
      const text = String(value).trim()
      counts[text] = (counts[text] ?? 0) + 1
      if (question.type === 'score') {
        const n = Number(text)
        if (Number.isFinite(n)) {
          numericSum += n
          numericN += 1
        }
      }
    }
    return {
      id: question.id,
      label: question.label,
      type: question.type,
      responseCount,
      counts,
      averageScore: numericN > 0 ? numericSum / numericN : null,
    }
  })
}

export function canSubmitSurvey(status: string): boolean {
  return status === 'OPEN'
}
