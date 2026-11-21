'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { uploadInvoicePaymentProof } from '@/app/(portal)/portal/invoices/actions'
import { Button } from '@/components/ui/button'

export function PortalPaymentProof({
  invoiceId,
  files,
}: {
  invoiceId: string
  files: { id: string; originalName: string }[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()

  function upload(list: FileList | null) {
    if (!list || list.length === 0) return
    const form = new FormData()
    form.set('invoiceId', invoiceId)
    form.set('file', list[0]!)
    start(async () => {
      const result = await uploadInvoicePaymentProof(form)
      if (result.ok) {
        toast.success('Payment proof uploaded.')
        router.refresh()
      } else {
        toast.error(result.error)
      }
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Payment proof</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload a bank slip, receipt, or screenshot after you pay. PDF or photo, 4 MB or smaller.
      </p>
      <div className="mt-3">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => upload(event.target.files)}
        />
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? 'Uploading…' : 'Upload proof'}
        </Button>
      </div>
      {files.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {files.map((file) => (
            <li key={file.id}>
              <a href={`/api/files/ledger/${file.id}`} className="text-primary hover:underline">
                {file.originalName}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No proof uploaded yet.</p>
      )}
    </section>
  )
}
