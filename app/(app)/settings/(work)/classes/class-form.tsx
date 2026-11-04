'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { saveClassForm, setClassActiveForm } from './actions'

export function ClassButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> New class
      </Button>
      {open ? <ClassDialog onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export function ClassRowActions({
  id,
  name,
  isActive,
}: {
  id: string
  name: string
  isActive: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(setClassActiveForm, idleState)
  const handled = useRef(false)

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Saved.')
      router.refresh()
    }
  }, [state, router])

  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open ? <ClassDialog id={id} name={name} onClose={() => setOpen(false)} /> : null}
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="isActive" value={isActive ? 'false' : 'true'} />
        <SubmitButton variant="ghost" size="sm" pendingLabel="Saving…">
          {isActive ? 'Archive' : 'Restore'}
        </SubmitButton>
      </form>
    </div>
  )
}

function ClassDialog({ id, name, onClose }: { id?: string; name?: string; onClose: () => void }) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveClassForm, idleState)
  const handled = useRef(false)

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Saved.')
      router.refresh()
      onClose()
    }
  }, [state, router, onClose])

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{id ? 'Edit class' : 'New class'}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {id ? <input type="hidden" name="id" value={id} /> : null}
          <Field name="name" label="Name" required error={state.fieldErrors?.name}>
            <Input
              {...fieldProps('name', state.fieldErrors?.name)}
              name="name"
              defaultValue={name ?? ''}
              autoFocus
            />
          </Field>
          <FormStatus state={state} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
