import { z } from 'zod'

import { calendarDate, cuid, optionalText, requiredText } from '@/lib/validation/common'

export const PROJECT_TASK_STAGES = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const

export const PROJECT_TASK_STAGE_LABELS: Record<(typeof PROJECT_TASK_STAGES)[number], string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

export const projectTaskSchema = z.object({
  projectId: cuid,
  name: requiredText('Task name', 120),
  description: optionalText(2000),
  stage: z.enum(PROJECT_TASK_STAGES).default('TODO'),
  assigneeId: z
    .union([cuid, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  deadline: z
    .union([calendarDate, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
})

export type ProjectTaskInput = z.infer<typeof projectTaskSchema>

export const updateProjectTaskSchema = projectTaskSchema
  .omit({ projectId: true })
  .extend({ id: cuid })

export const moveProjectTaskSchema = z.object({
  id: cuid,
  stage: z.enum(PROJECT_TASK_STAGES),
})
