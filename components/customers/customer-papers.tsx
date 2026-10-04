'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { removeCustomerFile } from '@/app/(app)/customers/actions'
import { formatDate } from '@/lib/date'

export type CustomerPaper = {
  id: string
  kind: 'PHOTO' | 'AGREEMENT'
  originalName: string
}

/** The portrait, the agreement date, and the debt papers stored with a customer. */
export function CustomerPapers({
  customerId,
  agreementDate,
  balanceDate,
  balanceTime,
  reminderDays,
  files,
  canEdit,
}: {
  customerId: string
  agreementDate: string | null
  balanceDate: string | null
  balanceTime: string | null
  reminderDays: number | null
  files: CustomerPaper[]
  canEdit: boolean
}) {
  const photo = files.find((file) => file.kind === 'PHOTO')
  const papers = files.filter((file) => file.kind === 'AGREEMENT')
  if (!photo && papers.length === 0 && !agreementDate && !balanceTime && !balanceDate && !reminderDays) return null

  return (
    <div className="mt-3 flex gap-4 border-t pt-3">
      {photo ? (
        <img
          src={`/api/customers/${customerId}/files/${photo.id}`}
          alt=""
          className="size-16 shrink-0 rounded-md object-cover"
        />
      ) : null}
      <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Agreement date</dt>
          <dd>{agreementDate ? formatDate(agreementDate) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Balance time</dt>
          <dd>{balanceTime ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Balance date</dt>
          <dd>{balanceDate ? formatDate(balanceDate) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Reminder</dt>
          <dd>{reminderDays ? `${reminderDays} days before` : '—'}</dd>
        </div>
        {papers.length > 0 ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Agreement papers</dt>
            <dd>
              <ul className="space-y-1">
                {papers.map((paper) => (
                  <li key={paper.id} className="flex items-center gap-2">
                    <a
                      href={`/api/customers/${customerId}/files/${paper.id}`}
                      className="text-[#0b4f6c] underline-offset-4 hover:underline"
                    >
                      {paper.originalName}
                    </a>
                    {canEdit ? <RemoveFile customerId={customerId} fileId={paper.id} /> : null}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {photo && canEdit ? (
          <div>
            <dt className="text-xs text-muted-foreground">Photo</dt>
            <dd>
              <RemoveFile customerId={customerId} fileId={photo.id} label="Remove photo" />
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}

function RemoveFile({ customerId, fileId, label = 'Remove' }: { customerId: string; fileId: string; label?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await removeCustomerFile({ customerId, fileId })
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          router.refresh()
        })
      }}
    >
      {label}
    </button>
  )
}
