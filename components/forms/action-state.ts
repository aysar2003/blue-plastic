import { formatAccessDeniedMessage } from '@/lib/access-denied'
import type { ActionResult } from '@/server/action'

/**
 * The shape every form in the app keeps in `useActionState`. Server Actions
 * return `ActionResult`; this adapts it to something a form can render, so there
 * is one form idiom in the codebase rather than one per page.
 */
export type FormState = {
  status: 'idle' | 'success' | 'error'
  message?: string
  /** AppError code, so a forbidden submit can be told apart from a typo. */
  code?: string
  fieldErrors?: Record<string, string[]>
  /**
   * The record that was created or saved. Carried so a dialog opened from
   * inside another form can hand the new record back and have it selected —
   * without the caller having to re-fetch the list and guess which one is new.
   */
  created?: { id: string; label?: string }
  /** Accept-invite URL when staff chose “send invite link” mode. */
  inviteUrl?: string
  /** Branded customer portal sign-in URL for this company (password mode). */
  portalLoginUrl?: string
  /** Email for a newly created portal login (shown once after invite). */
  portalEmail?: string
  /** Temporary password shown once after invite / reset. */
  temporaryPassword?: string
  /**
   * Rename hit an existing name — the form can offer to merge into that record
   * instead of leaving the user with a dead-end conflict.
   */
  mergeClash?: { id: string; name: string }
}

export const idleState: FormState = { status: 'idle' }

export function toFormState(result: ActionResult<unknown>, successMessage: string): FormState {
  if (result.ok) {
    const data = result.data as { id?: string; name?: string; displayName?: string } | undefined
    return {
      status: 'success',
      message: successMessage,
      created: data?.id ? { id: data.id, label: data.displayName ?? data.name } : undefined,
    }
  }
  if (result.error.code === 'FORBIDDEN') {
    return { status: 'error', code: 'FORBIDDEN', message: formatAccessDeniedMessage() }
  }
  const details = result.error.details
  if (
    result.error.code === 'CONFLICT' &&
    details?.merge?.[0] === 'true' &&
    details.clashId?.[0]
  ) {
    return {
      status: 'error',
      code: 'CONFLICT',
      message: result.error.message,
      mergeClash: {
        id: details.clashId[0],
        name: details.clashName?.[0] ?? '',
      },
    }
  }
  return {
    status: 'error',
    code: result.error.code,
    // Field-level errors are shown against their fields; only show a banner for
    // failures that belong to the form as a whole.
    message: details ? undefined : result.error.message,
    fieldErrors: details,
  }
}

/** Read a `FormData` into a plain object, dropping empty file inputs. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') values[key] = value
  }
  return values
}
