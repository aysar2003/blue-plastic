import 'server-only'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import { type OrgContext, requireOrgContext } from '@/server/auth/context'
import type { Permission } from '@/server/auth/permissions'
import { isNavigationError } from '@/lib/db-error'
import { AppError, type AppErrorCode, isAppError } from '@/server/errors'

/**
 * Server Actions never throw across the boundary. They return a discriminated
 * result so the caller handles failure as data, and an unexpected exception can
 * never leak a stack trace or a Prisma error message into the UI.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: AppErrorCode; message: string; details?: Record<string, string[]> } }

export const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data })

export const fail = (
  code: AppErrorCode,
  message: string,
  details?: Record<string, string[]>,
): ActionResult<never> => ({ ok: false, error: { code, message, details } })

function toResult(error: unknown): ActionResult<never> {
  if (isNavigationError(error)) throw error

  if (error instanceof z.ZodError) {
    const details: Record<string, string[]> = {}
    for (const issue of error.issues) {
      const key = issue.path.join('.') || '_'
      ;(details[key] ??= []).push(issue.message)
    }
    return fail('VALIDATION', 'Please correct the highlighted fields.', details)
  }

  if (isAppError(error)) {
    return fail(error.code, error.message, error.details)
  }

  // Genuinely unexpected. Log with a correlation id the user can quote; tell
  // them nothing else.
  const ref = randomUUID()
  console.error(`[action:${ref}]`, error)
  return fail('INTERNAL', `Something went wrong. Reference ${ref}.`)
}

type Handler<TInput, TOutput> = (ctx: OrgContext, input: TInput) => Promise<TOutput>

class ActionBuilder<TInput> {
  constructor(
    private readonly permission: Permission | undefined,
    private readonly schema: z.ZodType<TInput> | undefined,
  ) {}

  /** Guard the action. Omit only for actions that must run while signed out. */
  requires(permission: Permission): ActionBuilder<TInput> {
    return new ActionBuilder<TInput>(permission, this.schema)
  }

  input<T>(schema: z.ZodType<T>): ActionBuilder<T> {
    return new ActionBuilder<T>(this.permission, schema)
  }

  handler<TOutput>(fn: Handler<TInput, TOutput>) {
    return async (raw: unknown): Promise<ActionResult<TOutput>> => {
      try {
        const ctx = await requireOrgContext(this.permission)
        const parsed = this.schema ? this.schema.parse(raw) : (raw as TInput)
        return ok(await fn(ctx, parsed))
      } catch (error) {
        return toResult(error)
      }
    }
  }
}

/**
 * Usage:
 *
 *   export const updateOrganization = action
 *     .requires('org:update')
 *     .input(organizationUpdateSchema)
 *     .handler((ctx, input) => organizationService.update(ctx, input))
 */
export const action = new ActionBuilder<unknown>(undefined, undefined)

/** For actions that legitimately run without a session (sign-up, first-run setup). */
export async function publicAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn())
  } catch (error) {
    return toResult(error)
  }
}

export { AppError }
