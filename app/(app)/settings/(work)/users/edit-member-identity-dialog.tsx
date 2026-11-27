'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminUpdateMemberIdentity } from './actions'

export function EditMemberIdentityDialog({
  open,
  onOpenChange,
  membershipId,
  initialName,
  initialEmail,
  initialPhone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  membershipId: string
  initialName: string
  initialEmail: string
  initialPhone: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(initialPhone ?? '')

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setEmail(initialEmail)
    setPhone(initialPhone ?? '')
  }, [open, initialName, initialEmail, initialPhone])

  function save() {
    start(async () => {
      const result = await adminUpdateMemberIdentity({
        membershipId,
        name,
        email,
        phone: phone.trim() || undefined,
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(`Profile updated for ${result.data.name}.`)
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Change name, email (Gmail / login), and phone. Changing email signs them out of this
          company until they sign in again.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="member-identity-name">Name</Label>
            <Input
              id="member-identity-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-identity-email">Email / Gmail</Label>
            <Input
              id="member-identity-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-identity-phone">Phone</Label>
            <Input
              id="member-identity-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
              autoComplete="off"
              disabled={pending}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !name.trim() || !email.trim()} onClick={save}>
            Save profile
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
