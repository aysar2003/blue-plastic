import { z } from 'zod'

import { TODO_PRIORITIES } from '@/lib/todo-notify'
import { TODO_COMPLETIONS, TODO_STAGES } from '@/lib/todo-workflow'
import { calendarDate, cuid, optionalText, requiredText } from '@/lib/validation/common'

const optionalId = z
  .union([cuid, z.literal('')])
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

const optionalDue = z
  .union([calendarDate, z.literal('')])
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

const boolFlag = z
  .union([z.literal('true'), z.literal('false'), z.literal('on'), z.boolean()])
  .transform((value) => value === true || value === 'true' || value === 'on')

const priorityField = z.coerce
  .number()
  .int()
  .refine((value): value is (typeof TODO_PRIORITIES)[number] =>
    (TODO_PRIORITIES as readonly number[]).includes(value),
  )
  .default(0)

export const todoInputSchema = z.object({
  title: requiredText('Title', 200),
  notes: optionalText(4000),
  dueDate: optionalDue,
  assigneeId: optionalId,
  priority: priorityField,
  /** When true, email the assignee (soft-fail if SMTP missing). */
  notifyEmail: boolFlag.optional().default(false),
  /** When true, open WhatsApp (wa.me) for the assignee after save. */
  notifyWhatsapp: boolFlag.optional().default(false),
  /**
   * WhatsApp number (country code, digits). Overrides the assignee’s saved
   * phone for this send; when valid it is also stored on the user for next time.
   */
  whatsappPhone: optionalText(40),
})

export const todoCreateSchema = todoInputSchema

export const todoUpdateSchema = todoInputSchema.extend({
  id: cuid,
})

export const todoIdSchema = z.object({ id: cuid })

export const todoStageSchema = todoIdSchema.extend({
  stage: z.enum(TODO_STAGES),
})

export const todoCompleteSchema = todoIdSchema.extend({
  completionKind: z.enum(TODO_COMPLETIONS),
  completionNote: optionalText(4000),
}).superRefine((value, ctx) => {
  const note = value.completionNote?.trim() ?? ''
  if ((value.completionKind === 'REPORT' || value.completionKind === 'BLOCKED') && !note) {
    ctx.addIssue({
      code: 'custom',
      path: ['completionNote'],
      message: 'Add a short note for a blocked item or a complaint / report.',
    })
  }
})

export type TodoInput = z.infer<typeof todoInputSchema>
export type TodoCompleteInput = z.infer<typeof todoCompleteSchema>
