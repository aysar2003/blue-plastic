'use client'

import { useState } from 'react'
import { KeyRoundIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EditMemberAccessDialog } from './edit-member-access-dialog'

/** Primary control to open/close apps and change role for one member. */
export function ManageAccessButton({
  membershipId,
  role,
  name,
  permissionsOverride,
  roles,
  roleTemplates,
}: {
  membershipId: string
  role: string
  name: string
  permissionsOverride: string[]
  roles: string[]
  roleTemplates: Record<string, string[]>
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <KeyRoundIcon className="size-3.5" />
        Manage access
      </Button>
      <EditMemberAccessDialog
        open={open}
        onOpenChange={setOpen}
        membershipId={membershipId}
        name={name}
        initialRole={role}
        initialPermissions={permissionsOverride}
        roles={roles}
        roleTemplates={roleTemplates}
      />
    </>
  )
}
