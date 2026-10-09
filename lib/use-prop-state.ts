'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'

/**
 * State that starts as `prop` and resets when `prop` changes, without an effect.
 * Local edits stick until the incoming value actually changes.
 */
export function usePropState<T>(prop: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(prop)
  const [source, setSource] = useState(prop)
  if (!Object.is(prop, source)) {
    setSource(prop)
    setValue(prop)
  }
  return [value, setValue]
}
