'use client'

import { useEffect } from 'react'

import { installScrollChain } from '@/lib/scroll-chain'

/** Installs app-wide nested scroll chaining once the shell mounts. */
export function ScrollChain() {
  useEffect(() => {
    const ac = new AbortController()
    installScrollChain(ac.signal)
    return () => ac.abort()
  }, [])

  return null
}
