import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { aggregateSurvey, parseQuestions } from '@/lib/erp/survey-results'
import { requireOrgContext } from '@/server/auth/context'
import * as collab from '@/server/services/collab.service'

import { closeSurvey, createSurvey, submitResponse } from './actions'

export const metadata: Metadata = { title: 'Surveys' }

export default async function SurveysPage() {
  const ctx = await requireOrgContext('knowledge:read')
  const surveys = await collab.listSurveys(ctx)

  return (
    <>
      <PageHeader title="Surveys" description="Open a form, collect answers, then close it and read the tally." />
      <Card className="mb-6 max-w-md space-y-3 p-4">
        <form action={createSurvey} className="space-y-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" className="mt-1" />
          </div>
          {(['q1', 'q2', 'q3'] as const).map((key, index) => (
            <div key={key} className="grid grid-cols-[1fr_120px] gap-2">
              <div>
                <Label htmlFor={key}>{index === 0 ? 'Questions' : `Question ${index + 1}`}</Label>
                <Input
                  id={key}
                  name={key}
                  required={index === 0}
                  className="mt-1"
                  placeholder={index === 0 ? 'How did we do?' : 'Optional'}
                />
              </div>
              <div>
                <Label htmlFor={`${key}Type`}>Type</Label>
                <NativeSelect id={`${key}Type`} name={`${key}Type`} className="mt-1">
                  <option value="text">Text</option>
                  <option value="choice">Choice</option>
                  <option value="score">Score</option>
                </NativeSelect>
              </div>
            </div>
          ))}
          <Button type="submit" size="sm">
            Create survey
          </Button>
        </form>
      </Card>
      <ul className="space-y-4">
        {surveys.map((survey) => {
          const questions = parseQuestions(survey.questions)
          const tally = aggregateSurvey(questions, survey.responses)
          return (
            <li key={survey.id} className="rounded-md border p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">{survey.title}</span>
                <span className="text-muted-foreground">
                  {survey.status} · {survey._count.responses} responses
                </span>
              </div>
              {survey.status === 'OPEN' ? (
                <form action={submitResponse} className="space-y-2">
                  <input type="hidden" name="surveyId" value={survey.id} />
                  {questions.map((question) => (
                    <div key={question.id}>
                      <Label htmlFor={`${survey.id}-${question.id}`}>{question.label}</Label>
                      <Input
                        id={`${survey.id}-${question.id}`}
                        name={`answer_${question.id}`}
                        className="mt-1"
                      />
                    </div>
                  ))}
                  <Input name="respondent" placeholder="Your name" className="max-w-xs" />
                  <Button type="submit" size="sm" variant="secondary">
                    Submit
                  </Button>
                </form>
              ) : null}
              {tally.length > 0 ? (
                <ul className="text-muted-foreground mt-3 space-y-1 text-xs">
                  {tally.map((row) => (
                    <li key={row.id}>
                      {row.label}: {row.responseCount} answers
                      {row.averageScore != null ? ` · avg ${row.averageScore.toFixed(1)}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
              {survey.status === 'OPEN' ? (
                <form action={closeSurvey} className="mt-3">
                  <input type="hidden" name="surveyId" value={survey.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Close survey
                  </Button>
                </form>
              ) : null}
            </li>
          )
        })}
      </ul>
    </>
  )
}
