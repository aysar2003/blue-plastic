'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import {
  todoCompleteSchema,
  todoCreateSchema,
  todoIdSchema,
  todoStageSchema,
  todoUpdateSchema,
} from '@/lib/validation/todo'
import { action } from '@/server/action'
import type { TodoNotifyResult } from '@/server/services/todo-notify.service'
import * as todoService from '@/server/services/todo.service'

function revalidateTodos() {
  revalidatePath('/todos')
  revalidatePath('/dashboard')
}

function emailWarningFrom(notify: TodoNotifyResult[]): string | undefined {
  const email = notify.find((row) => row.channel === 'email' && !row.ok)
  return email?.message
}

function whatsappFrom(notify: TodoNotifyResult[]): {
  url?: string
  warning?: string
} {
  const row = notify.find((item) => item.channel === 'whatsapp')
  if (!row) return {}
  if (row.ok && row.whatsappUrl) return { url: row.whatsappUrl }
  if (!row.ok && row.message) return { warning: row.message }
  return {}
}

function mergeWarnings(...parts: (string | undefined)[]): string | undefined {
  const lines = parts.filter((part): part is string => Boolean(part))
  if (lines.length === 0) return undefined
  return lines.join(' ')
}

export const createTodo = action
  .requires('todo:create')
  .input(todoCreateSchema)
  .handler(async (ctx, input) => {
    const { row, notify } = await todoService.create(ctx, input)
    revalidateTodos()
    const wa = whatsappFrom(notify)
    return {
      id: row.id,
      name: row.title,
      emailWarning: emailWarningFrom(notify),
      whatsappUrl: wa.url,
      whatsappWarning: wa.warning,
    }
  })

export const updateTodo = action
  .requires('todo:update')
  .input(todoUpdateSchema)
  .handler(async (ctx, input) => {
    const { id, ...rest } = input
    const { row, notify } = await todoService.update(ctx, id, rest)
    revalidateTodos()
    const wa = whatsappFrom(notify)
    return {
      id: row.id,
      name: row.title,
      emailWarning: emailWarningFrom(notify),
      whatsappUrl: wa.url,
      whatsappWarning: wa.warning,
    }
  })

export const setTodoStage = action
  .requires('todo:update')
  .input(todoStageSchema)
  .handler(async (ctx, input) => {
    const row = await todoService.setStage(ctx, input.id, input.stage)
    revalidateTodos()
    return { id: row.id, name: row.title }
  })

export const completeTodo = action
  .requires('todo:update')
  .input(todoCompleteSchema)
  .handler(async (ctx, input) => {
    const row = await todoService.complete(ctx, input)
    revalidateTodos()
    return { id: row.id, name: row.title }
  })

export const reopenTodo = action
  .requires('todo:update')
  .input(todoIdSchema)
  .handler(async (ctx, input) => {
    const row = await todoService.reopen(ctx, input.id)
    revalidateTodos()
    return { id: row.id, name: row.title }
  })

/** @deprecated Prefer setTodoStage / completeTodo / reopenTodo. */
export const toggleTodo = action
  .requires('todo:update')
  .input(
    todoIdSchema.extend({
      done: z.union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('on')]).transform(
        (value) => value === true || value === 'true' || value === 'on',
      ),
    }),
  )
  .handler(async (ctx, input) => {
    const row = input.done
      ? await todoService.complete(ctx, {
          id: input.id,
          completionKind: 'COMPLETED',
          completionNote: null,
        })
      : await todoService.reopen(ctx, input.id)
    revalidateTodos()
    return { id: row.id, name: row.title }
  })

export const deleteTodo = action
  .requires('todo:delete')
  .input(todoIdSchema)
  .handler(async (ctx, input) => {
    await todoService.remove(ctx, input.id)
    revalidateTodos()
    return { id: input.id }
  })

export async function createTodoForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await createTodo(formValues(formData))
  const state = toFormState(result, 'Added to your list.')
  if (!result.ok) return state
  return {
    ...state,
    warning: mergeWarnings(result.data.emailWarning, result.data.whatsappWarning),
    whatsappUrl: result.data.whatsappUrl,
  }
}

export async function updateTodoForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await updateTodo(formValues(formData))
  const state = toFormState(result, 'To-do saved.')
  if (!result.ok) return state
  return {
    ...state,
    warning: mergeWarnings(result.data.emailWarning, result.data.whatsappWarning),
    whatsappUrl: result.data.whatsappUrl,
  }
}
