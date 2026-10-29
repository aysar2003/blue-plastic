'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { shareArticle, unshareArticle } from '@/app/(app)/knowledge/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/native-select'

type Member = { id: string; name: string; email: string }
type Share = { userId: string; name: string; canEdit: boolean }

export function KnowledgeShareDialog({
  open,
  onOpenChange,
  articleId,
  shares,
  members,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  articleId: string
  shares: Share[]
  members: Member[]
  onDone: () => void
}) {
  const [userId, setUserId] = useState('')
  const [canEdit, setCanEdit] = useState(false)
  const [pending, start] = useTransition()

  const available = members.filter((member) => !shares.some((share) => share.userId === member.id))

  function invite() {
    if (!userId) return
    start(async () => {
      const result = await shareArticle({ id: articleId, userId, canEdit })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Invited')
      setUserId('')
      setCanEdit(false)
      onDone()
    })
  }

  function remove(targetId: string) {
    start(async () => {
      const result = await unshareArticle({ id: articleId, userId: targetId })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Removed')
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share article</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Inviting someone moves the page to Shared. They see it in their Shared sidebar.
        </p>
        <div className="space-y-2">
          <NativeSelect
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            aria-label="Colleague"
          >
            <option value="">Choose a colleague…</option>
            {available.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </NativeSelect>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={canEdit}
              onChange={(event) => setCanEdit(event.target.checked)}
            />
            Can edit
          </label>
          <Button type="button" disabled={pending || !userId} onClick={invite}>
            Invite
          </Button>
        </div>
        {shares.length > 0 ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {shares.map((share) => (
              <li key={share.userId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {share.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {share.canEdit ? 'Can edit' : 'Can read'}
                  </span>
                </span>
                <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => remove(share.userId)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No one invited yet.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
