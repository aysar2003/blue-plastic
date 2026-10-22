'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { deleteCompanyFromDetail } from './actions'

export function DeleteCompanyButton({
  orgId,
  companyName,
  emphasize,
}: {
  orgId: string
  companyName: string
  /** Rent or agreement ended — make the danger path obvious. */
  emphasize?: boolean
}) {
  const router = useRouter()
  const { update } = useSession()
  const [open, setOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [pending, start] = useTransition()

  const run = () => {
    start(async () => {
      const result = await deleteCompanyFromDetail({ orgId, confirmName })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not delete that company.')
        return
      }
      toast.success(`${result.data.deletedName} deleted.`)
      setOpen(false)
      if (result.data.switchToOrgId) {
        await update({ orgId: result.data.switchToOrgId })
      }
      router.push('/databases')
      router.refresh()
    })
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={emphasize ? 'destructive' : 'outline'}
        className={emphasize ? undefined : 'text-destructive hover:text-destructive'}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon />
        Delete company
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {companyName}?</DialogTitle>
            <DialogDescription>
              This permanently removes the company database and all its books. Soft-deleted
              Trash rows inside other companies are unaffected. Type the company name to
              confirm.
              {emphasize ? (
                <span className="mt-2 block font-medium text-amber-600 dark:text-amber-400">
                  Rent or an agreement has ended — this is the usual time to remove the
                  company.
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-company-name">Company name</Label>
            <Input
              id="confirm-company-name"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              placeholder={companyName}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || !confirmName.trim()}
              onClick={run}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
