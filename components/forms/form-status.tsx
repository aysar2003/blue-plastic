import { CheckCircle2Icon } from 'lucide-react'

import { FormError } from './form-error'
import type { FormState } from './action-state'

/**
 * The banner at the top of a form: red when it failed, green when it saved,
 * nothing while it is untouched.
 *
 * Every form uses this rather than `FormError` directly. Rendering
 * `<FormError message={state.message} />` unconditionally — which is what the
 * forms used to do — shows the *success* message in the error banner, because
 * `state.message` carries both. Saving an invoice announced "INV-0001 saved" in
 * red.
 */
function errorBannerMessage(state: FormState): string | undefined {
  if (state.message) return state.message
  if (!state.fieldErrors) return undefined
  for (const messages of Object.values(state.fieldErrors)) {
    const first = messages.find((message) => message.trim() !== '')
    if (first) return first
  }
  return undefined
}

export function FormStatus({ state }: { state: FormState }) {
  if (state.status === 'error') return <FormError message={errorBannerMessage(state)} />

  if (state.status === 'success' && state.message) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-md border border-success/30 bg-success/8 px-3 py-2 text-sm text-success"
      >
        <CheckCircle2Icon className="size-4 shrink-0" />
        <span>{state.message}</span>
      </div>
    )
  }

  return null
}
