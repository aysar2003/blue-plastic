import { FORBIDDEN_DIGEST } from '@/lib/forbidden-digest'

/**
 * Errors that are safe to show a user and stable enough to branch on.
 * Anything not thrown as an AppError is treated as a bug: logged with a
 * correlation id, surfaced as a generic message.
 */
export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL'

const STATUS: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  RATE_LIMITED: 429,
  INTERNAL: 500,
}

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly status: number
  readonly details?: Record<string, string[]>
  /** Set for FORBIDDEN so the page boundary can render access denied. */
  readonly digest?: string

  constructor(code: AppErrorCode, message: string, details?: Record<string, string[]>) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = STATUS[code]
    this.details = details
    if (code === 'FORBIDDEN') this.digest = FORBIDDEN_DIGEST
  }
}

export const unauthenticated = (m = 'You are not signed in.') => new AppError('UNAUTHENTICATED', m)

/**
 * Permission denial. On a page render this switches to the access-denied
 * screen. Actions and route handlers still receive the AppError.
 */
export function forbidden(message = 'You do not have permission to do that.'): AppError {
  if (!process.env.VITEST) {
    let interrupt: (() => void) | undefined
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      interrupt = (require('./forbidden-page') as typeof import('./forbidden-page')).interruptForbiddenPage
    } catch {
      interrupt = undefined
    }
    interrupt?.()
  }
  return new AppError('FORBIDDEN', message)
}
export const notFound = (what = 'Record') => new AppError('NOT_FOUND', `${what} not found.`)
export const conflict = (m: string) => new AppError('CONFLICT', m)
export const validation = (m: string, details?: Record<string, string[]>) =>
  new AppError('VALIDATION', m, details)
export const precondition = (m: string) => new AppError('PRECONDITION_FAILED', m)

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError
}
