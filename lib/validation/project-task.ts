import { z } from 'zod'

import { calendarDate, cuid, optionalText, requiredText } from '@/lib/validation/common'

/** Built-in stages; projects may add custom keys via boardStages. */
export const PROJECT_TASK_STAGES = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const

export const PROJECT_TASK_STAGE_LABELS: Record<(typeof PROJECT_TASK_STAGES)[number], string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

const optionalCuid = z
  .union([cuid, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

const optionalDate = z
  .union([calendarDate, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

export const projectTaskSchema = z.object({
  projectId: cuid,
  name: requiredText('Task name', 120),
  description: optionalText(2000),
  stage: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Stage key must be UPPER_SNAKE')
    .default('TODO'),
  assigneeId: optionalCuid,
  deadline: optionalDate,
  startDate: optionalDate,
  parentTaskId: optionalCuid,
})

export type ProjectTaskInput = z.infer<typeof projectTaskSchema>

export const updateProjectTaskSchema = projectTaskSchema
  .omit({ projectId: true })
  .extend({ id: cuid })

export const moveProjectTaskSchema = z.object({
  id: cuid,
  stage: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Stage key must be UPPER_SNAKE'),
})

export const projectTaskDependencySchema = z.object({
  predecessorId: cuid,
  successorId: cuid,
})

export type ProjectTaskDependencyInput = z.infer<typeof projectTaskDependencySchema>

export const projectBoardStageSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Stage key must be UPPER_SNAKE'),
  label: requiredText('Stage label', 60),
})

export const projectBoardStagesSchema = z.array(projectBoardStageSchema).min(1).max(20)

export type ProjectBoardStage = z.infer<typeof projectBoardStageSchema>
