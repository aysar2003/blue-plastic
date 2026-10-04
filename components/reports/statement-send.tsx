'use client'

import { useState } from 'react'
import { FileDownIcon, Loader2Icon, MailIcon, PrinterIcon } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
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

/**
 * Print, download the PDF, or hand it to the mail program.
 *
 * There is no mail server here, so Email opens the program the user already
 * sends mail from, with the statement written in the message. When that
 * program can take a file, the PDF goes with it. Otherwise the PDF downloads
 * and the message opens ready for the file to be attached.
 */
export function StatementSend({
  pdfHref,
  filename,
  defaultTo,
  defaultSubject,
  defaultBody,
}: {
  pdfHref: string
  filename: string
  defaultTo: string
  defaultSubject: string
  defaultBody: string
}) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState(defaultBody)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const send = async () => {
    setBusy(true)
    setNote(null)
    try {
      const response = await fetch(pdfHref)
      if (!response.ok) {
        setNote('The PDF could not be prepared.')
        return
      }
      const blob = await response.blob()
      const file = new File([blob], filename, { type: 'application/pdf' })
      const payload = { files: [file], title: subject, text: body }
      if (typeof navigator.share === 'function' && navigator.canShare?.(payload)) {
        await navigator.share(payload)
        setNote('The PDF is ready to send from the share window.')
        return
      }
      downloadBlob(blob, filename)
      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(clip(body))}`
      setNote('The PDF downloaded. Attach it to the email that opened.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setNote('The email could not be opened.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5 print:hidden">
      <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
        <PrinterIcon /> Print
      </Button>
      <a href={pdfHref} download={filename} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        <FileDownIcon /> PDF
      </a>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          <MailIcon /> Email
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email this statement</DialogTitle>
            <DialogDescription>
              The message opens in your email program with this statement written out. The PDF
              downloads so you can attach it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="statement-to">To</Label>
              <Input
                id="statement-to"
                type="email"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="customer@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="statement-subject">Subject</Label>
              <Input
                id="statement-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="statement-body">Message</Label>
              <textarea
                id="statement-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={10}
                className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-[0.8125rem] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
              />
            </div>
            {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={send} disabled={busy}>
              {busy ? <Loader2Icon className="animate-spin" /> : <MailIcon />}
              Email statement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function clip(value: string): string {
  if (value.length <= 1500) return value
  return `${value.slice(0, 1400)}\n\nThe rest of the statement is in the attached PDF.`
}
