'use client'

import { signOut } from 'next-auth/react'

import { Button } from '@/components/ui/button'

/** Ends the session and returns to the branded portal login (or generic). */
export function PortalSignOutButton({
  callbackUrl = '/portal/login',
  label = 'Sign out',
}: {
  callbackUrl?: string
  label?: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => signOut({ callbackUrl })}
    >
      {label}
    </Button>
  )
}
