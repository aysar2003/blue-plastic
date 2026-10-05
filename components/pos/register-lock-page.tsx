'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { RegisterLock, writeRegisterLocked } from '@/components/pos/register-lock'

/** Full-screen lock for one register. Unlock returns to that till. */
export function RegisterLockPage({ orgName, registerId }: { orgName: string; registerId: string }) {
  const router = useRouter()

  useEffect(() => {
    writeRegisterLocked(registerId, true)
  }, [registerId])

  return (
    <RegisterLock
      orgName={orgName}
      onUnlock={() => {
        writeRegisterLocked(registerId, false)
        router.push(`/pos/${registerId}`)
      }}
    />
  )
}
