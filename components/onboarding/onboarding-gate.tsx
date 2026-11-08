'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const ALLOW = [
  '/onboarding',
  '/settings',
  '/help',
  '/billing',
  '/databases',
  '/login',
  '/profile',
]

function isAllowed(pathname: string) {
  return ALLOW.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/** Sends company admins to /onboarding until the wizard is finished or skipped. */
export function OnboardingGate({ needed }: { needed: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!needed || !pathname || isAllowed(pathname)) return
    router.replace('/onboarding')
  }, [needed, pathname, router])

  return null
}
