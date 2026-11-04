'use client'

import { useEffect, useRef } from 'react'

import type { FormState } from './action-state'

/**
 * When a save comes back as a duplicate warning, ask once and submit the same
 * form again with the acknowledgement flag set. A plain Save click clears the
 * flag so a later, different duplicate is still asked about.
 */
export function useDuplicatePrompt(state: FormState) {
  const acknowledge = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const asked = useRef<string | null>(null)
  const resubmit = useRef(false)

  useEffect(() => {
    if (state.status === 'success') {
      acknowledge.current = false
      asked.current = null
      return
    }
    if (state.status !== 'error' || !state.duplicate) return
    const key = `${state.duplicate.existingId}:${state.message ?? ''}`
    if (asked.current === key) return
    asked.current = key
    const proceed = window.confirm(`${state.message ?? 'This looks like a duplicate.'}\n\nSave it anyway?`)
    if (!proceed) return
    acknowledge.current = true
    resubmit.current = true
    formRef.current?.requestSubmit()
  }, [state])

  function beforeSubmit() {
    if (resubmit.current) {
      resubmit.current = false
      return
    }
    acknowledge.current = false
  }

  return { acknowledge, formRef, beforeSubmit }
}
