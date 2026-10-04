'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FileDownIcon,
  Loader2Icon,
  MailIcon,
  MessageCircleIcon,
  PrinterIcon,
} from 'lucide-react'

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
 * Print, PDF, Email, and WhatsApp for any paper the books produce.
 *
 * There is no mail or WhatsApp server here — Email and WhatsApp open the apps
 * the user already uses. When a PDF URL is available it downloads (or shares)
 * with the message; otherwise Print / Save as PDF covers the file.
 */
export function DocumentActions({
  paper = 'document',
  pdfHref,
  filename,
  printHref,
  defaultTo = '',
  defaultSubject,
  defaultBody,
  whatsappPhone,
  whatsappText,
}: {
  /** Shown in dialog copy — "statement", "delivery report", "invoice". */
  paper?: string
  pdfHref?: string
  filename?: string
  /** Dedicated print page. When omitted, Print uses the current page. */
  printHref?: string
  defaultTo?: string
  defaultSubject?: string
  defaultBody?: string
  whatsappPhone?: string | null
  whatsappText?: string
}) {
  const [emailOpen, setEmailOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState(defaultSubject ?? '')
  const [body, setBody] = useState(defaultBody ?? '')
  const [waPhone, setWaPhone] = useState(digitsOnly(whatsappPhone) ?? '')
  const [waText, setWaText] = useState(whatsappText ?? defaultBody ?? '')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const file = filename ?? `${paper.replace(/\s+/g, '-').toLowerCase()}.pdf`
  const subjectLine = subject || `Your ${paper}`

  const print = () => {
    if (printHref) {
      window.location.href = printHref
      return
    }
    window.print()
  }

  const downloadPdf = () => {
    if (pdfHref) return
    window.print()
  }

  const sharePdf = async (mode: 'email' | 'whatsapp') => {
    setBusy(true)
    setNote(null)
    try {
      if (pdfHref) {
        const response = await fetch(pdfHref)
        if (!response.ok) {
          setNote('The PDF could not be prepared.')
          return
        }
        const blob = await response.blob()
        const pdfFile = new File([blob], file, { type: 'application/pdf' })
        const payload = { files: [pdfFile], title: subjectLine, text: body || waText }
        if (typeof navigator.share === 'function' && navigator.canShare?.(payload)) {
          await navigator.share(payload)
          setNote('The PDF is ready to send from the share window.')
          return
        }
        downloadBlob(blob, file)
      }

      if (mode === 'email') {
        window.location.href = `mailto:${to}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(clip(body))}`
        setNote(
          pdfHref
            ? 'The PDF downloaded. Attach it to the email that opened.'
            : 'The email opened. Use Print → Save as PDF if you need a file attached.',
        )
        return
      }

      const phone = digitsOnly(waPhone)
      if (!phone) {
        setNote('Enter a WhatsApp number with country code, for example 25261…')
        return
      }
      const text = waText.trim() || subjectLine
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
      setNote(
        pdfHref
          ? 'WhatsApp opened. Attach the PDF that downloaded.'
          : 'WhatsApp opened. Attach a PDF from Print → Save as PDF if needed.',
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setNote(mode === 'email' ? 'The email could not be opened.' : 'WhatsApp could not be opened.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 print:hidden">
      {printHref ? (
        <Link href={printHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <PrinterIcon /> Print
        </Link>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={print}>
          <PrinterIcon /> Print
        </Button>
      )}

      {pdfHref ? (
        <a href={pdfHref} download={file} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <FileDownIcon /> PDF
        </a>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={downloadPdf} title="Opens print — choose Save as PDF">
          <FileDownIcon /> PDF
        </Button>
      )}

      <Dialog
        open={emailOpen}
        onOpenChange={(next) => {
          setEmailOpen(next)
          if (next) setNote(null)
        }}
      >
        <Button type="button" size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
          <MailIcon /> Email
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email this {paper}</DialogTitle>
            <DialogDescription>
              Opens your email program. {pdfHref ? 'The PDF downloads so you can attach it.' : 'Use Print → Save as PDF for a file.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="doc-email-to">To</Label>
              <Input
                id="doc-email-to"
                type="email"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="name@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-email-subject">Subject</Label>
              <Input
                id="doc-email-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-email-body">Message</Label>
              <textarea
                id="doc-email-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={8}
                className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-[0.8125rem] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
              />
            </div>
            {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEmailOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={() => void sharePdf('email')} disabled={busy}>
              {busy ? <Loader2Icon className="animate-spin" /> : <MailIcon />}
              Email {paper}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={waOpen}
        onOpenChange={(next) => {
          setWaOpen(next)
          if (next) setNote(null)
        }}
      >
        <Button type="button" size="sm" variant="outline" onClick={() => setWaOpen(true)}>
          <MessageCircleIcon /> WhatsApp
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send on WhatsApp</DialogTitle>
            <DialogDescription>
              Opens WhatsApp with the message. Use a number with country code (no +).{' '}
              {pdfHref ? 'The PDF downloads so you can attach it in the chat.' : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="doc-wa-phone">WhatsApp number</Label>
              <Input
                id="doc-wa-phone"
                inputMode="tel"
                value={waPhone}
                onChange={(event) => setWaPhone(event.target.value)}
                placeholder="25261…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-wa-text">Message</Label>
              <textarea
                id="doc-wa-text"
                value={waText}
                onChange={(event) => setWaText(event.target.value)}
                rows={6}
                className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-[0.8125rem] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
              />
            </div>
            {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWaOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={() => void sharePdf('whatsapp')} disabled={busy}>
              {busy ? <Loader2Icon className="animate-spin" /> : <MessageCircleIcon />}
              Open WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Digits only for wa.me — strips spaces, +, and punctuation. */
export function digitsOnly(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  return digits.length >= 8 ? digits : null
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function clip(value: string): string {
  if (value.length <= 1500) return value
  return `${value.slice(0, 1400)}\n\nThe rest is in the attached PDF.`
}
