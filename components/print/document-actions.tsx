'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
  MailIcon,
  MessageCircleIcon,
} from 'lucide-react'

import { getOutboundMailStatus, sendDocumentEmail } from '@/app/(app)/print/email-actions'
import { PdfInkMenu, PrintInkMenu } from '@/components/print/print-ink-menu'
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
import { buildPackPrintHtml, hasPrintablePaper } from '@/lib/pack-print-html'
import { readStoredPaperMetaHidden, withPaperMetaHidden } from '@/lib/paper-meta-fields'
import { paperChoiceCookie } from '@/lib/paper-choice'
import type { PaperStyle } from '@/lib/document-template'
import { withPrintInk } from '@/lib/print-ink'
import { cn } from '@/lib/utils'

type AttachFormat = 'pdf' | 'excel'

/**
 * Print, PDF, Email, and WhatsApp for any paper the books produce.
 *
 * Print and PDF each offer Color or Black & White. When the company has SMTP
 * connected (Settings → Organisation), Email sends from the server with the
 * attachment. Otherwise it falls back to download + mailto / share.
 */
export function DocumentActions({
  paper = 'document',
  pdfHref,
  excelHref,
  filename,
  printHref,
  backHref,
  defaultTo = '',
  defaultSubject,
  defaultBody,
  whatsappPhone,
  whatsappText,
  pdfMatchesPrint = false,
  paperStyle = 'merchant',
}: {
  /** Shown in dialog copy — "statement", "delivery report", "invoice". */
  paper?: string
  pdfHref?: string
  /** Downloads a spreadsheet of the same rows. Omitted where Excel already lives elsewhere. */
  excelHref?: string
  filename?: string
  /** Dedicated print page. When omitted, Print uses the current page. */
  printHref?: string
  /** Leave the print / share screen and return to the document. */
  backHref?: string
  defaultTo?: string
  defaultSubject?: string
  defaultBody?: string
  whatsappPhone?: string | null
  whatsappText?: string
  /**
   * Pack print: PDF uses the on-screen HTML (same as Print → Save as PDF)
   * instead of the compact server PDF. Email / WhatsApp still download pdfHref.
   */
  pdfMatchesPrint?: boolean
  /** Sheet currently on this paper. Merchant or Trade. */
  paperStyle?: PaperStyle
}) {
  const [emailOpen, setEmailOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [to, setTo] = useState(defaultTo)
  const savedRecipient = defaultTo.trim()
  const [subject, setSubject] = useState(defaultSubject ?? '')
  const [body, setBody] = useState(defaultBody ?? '')
  const [waPhone, setWaPhone] = useState(digitsOnly(whatsappPhone) ?? '')
  const [waText, setWaText] = useState(whatsappText ?? defaultBody ?? '')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [serverMail, setServerMail] = useState<{ configured: boolean; from: string | null } | null>(
    null,
  )
  const router = useRouter()

  function choosePaper(style: PaperStyle) {
    if (style === paperStyle) return
    document.cookie = paperChoiceCookie(style)
    router.refresh()
  }

  useEffect(() => {
    if (!emailOpen) return
    let cancelled = false
    void getOutboundMailStatus(undefined).then((result) => {
      if (cancelled || !result.ok) return
      setServerMail({
        configured: result.data.configured,
        from: result.data.from,
      })
    })
    return () => {
      cancelled = true
    }
  }, [emailOpen])

  const excelAvailable = Boolean(excelHref)
  const [attachFormat, setAttachFormat] = useState<AttachFormat>('pdf')

  const baseName = (filename ?? paper.replace(/\s+/g, '-').toLowerCase()).replace(/\.(pdf|xlsx|xls|csv)$/i, '')
  const subjectLine = subject || `Your ${paper}`

  const prepareFile = async (): Promise<{ blob: Blob; name: string; mime: string } | null> => {
    const ink = 'color' as const
    if (attachFormat === 'excel') {
      if (!excelHref) {
        setNote('Excel is not available for this document.')
        return null
      }
      const response = await fetch(excelHref)
      if (!response.ok) {
        setNote('The Excel file could not be prepared.')
        return null
      }
      const blob = await response.blob()
      const fromHeader = filenameFromContentDisposition(response.headers.get('content-disposition'))
      const ext = fromHeader?.match(/\.(xlsx|xls|csv)$/i)?.[1]?.toLowerCase() ?? 'xlsx'
      const mime =
        blob.type ||
        (ext === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      return { blob, name: fromHeader ?? `${baseName}.${ext}`, mime }
    }

    let blob: Blob | null = null
    if (pdfMatchesPrint || hasPrintablePaper()) {
      try {
        const html = await buildPackPrintHtml(ink)
        const screen = await fetch('/api/print/html-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html, filename: `${baseName}.pdf` }),
        })
        if (screen.ok) {
          const next = await screen.blob()
          if (next.size > 500) blob = next
        }
      } catch {
        /* fall through to API PDF */
      }
    }
    if (!blob && pdfHref) {
      const response = await fetch(
        withPaperMetaHidden(withPrintInk(pdfHref, ink), readStoredPaperMetaHidden()),
      )
      if (!response.ok) {
        setNote('The PDF could not be prepared.')
        return null
      }
      blob = await response.blob()
    }
    if (!blob) {
      setNote('Choose Print → Save as PDF first, or pick Excel if it is available.')
      return null
    }
    return { blob, name: `${baseName}.pdf`, mime: 'application/pdf' }
  }

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Could not read the file.'))
      reader.onload = () => {
        const dataUrl = String(reader.result ?? '')
        const comma = dataUrl.indexOf(',')
        resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl)
      }
      reader.readAsDataURL(blob)
    })

  const sendViaServer = async () => {
    setBusy(true)
    setNote(null)
    try {
      if (!to.trim()) {
        setNote('Enter the recipient email address.')
        return
      }
      if (attachFormat === 'excel' && !excelAvailable) {
        setNote('Excel is not available for this document.')
        return
      }
      const prepared = await prepareFile()
      if (!prepared) return
      const contentBase64 = await blobToBase64(prepared.blob)
      const result = await sendDocumentEmail({
        to: to.trim(),
        subject: subjectLine,
        body: body.trim(),
        filename: prepared.name,
        contentBase64,
        contentType: prepared.mime,
      })
      if (!result.ok) {
        setNote(result.error.message)
        return
      }
      setNote(
        serverMail?.from
          ? `Sent from ${serverMail.from}.`
          : 'Email sent from your company mailbox.',
      )
    } catch {
      setNote('The email could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  const shareFile = async (mode: 'email' | 'whatsapp') => {
    setBusy(true)
    setNote(null)
    try {
      if (attachFormat === 'excel' && !excelAvailable) {
        setNote('Excel is not available for this document.')
        return
      }

      const prepared = await prepareFile()
      if (prepared) {
        const file = new File([prepared.blob], prepared.name, { type: prepared.mime })
        const payload = { files: [file], title: subjectLine, text: body || waText }
        if (typeof navigator.share === 'function' && navigator.canShare?.(payload)) {
          await navigator.share(payload)
          setNote(
            attachFormat === 'excel'
              ? 'Excel is ready in the share window — pick Gmail or Mail to send.'
              : 'PDF is ready in the share window — pick Gmail or Mail to send.',
          )
          return
        }
        downloadBlob(prepared.blob, prepared.name)
      }

      if (mode === 'email') {
        window.location.href = `mailto:${to}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(
          clip(body, attachFormat),
        )}`
        setNote(
          prepared
            ? `${attachFormat === 'excel' ? 'Excel' : 'PDF'} downloaded. Attach the file from Downloads to the email that opened.`
            : 'The email opened. Pick a format above, or use Print → Save as PDF.',
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
        prepared
          ? `${attachFormat === 'excel' ? 'Excel' : 'PDF'} downloaded. Attach it in the WhatsApp chat.`
          : 'WhatsApp opened. Attach a file from Print or Excel if needed.',
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setNote(mode === 'email' ? 'The email could not be opened.' : 'WhatsApp could not be opened.')
    } finally {
      setBusy(false)
    }
  }

  const formatPicker = (
    <div className="space-y-1.5">
      <Label>Attach as</Label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setAttachFormat('pdf')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm',
            attachFormat === 'pdf' ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-input',
          )}
        >
          <FileTextIcon className="size-4" />
          PDF
        </button>
        <button
          type="button"
          onClick={() => {
            if (!excelAvailable) {
              setNote('Excel is not available for this document.')
              return
            }
            setAttachFormat('excel')
            setNote(null)
          }}
          disabled={!excelAvailable}
          className={cn(
            'flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50',
            attachFormat === 'excel' ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-input',
          )}
        >
          <FileSpreadsheetIcon className="size-4" />
          Excel
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {excelAvailable
          ? 'PDF or Excel. When outgoing email is connected, Send attaches the file automatically.'
          : 'PDF only on this page. Excel appears where a spreadsheet export exists (statements, reports).'}
      </p>
    </div>
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5 print:hidden">
      {backHref ? (
        <Link href={backHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <ArrowLeftIcon /> Back
        </Link>
      ) : null}

      <div className="flex items-center rounded-md border border-input p-0.5">
        {(
          [
            ['merchant', 'Merchant'],
            ['trade', 'Trade'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => choosePaper(id)}
            className={cn(
              'rounded px-2 py-1 text-xs font-medium',
              paperStyle === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <PrintInkMenu printHref={printHref} />
      <PdfInkMenu pdfHref={pdfHref} filename={`${baseName}.pdf`} matchPrintPaper={pdfMatchesPrint} />
      {excelHref ? (
        <a href={excelHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <FileSpreadsheetIcon /> Excel
        </a>
      ) : null}

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
              {serverMail?.configured
                ? `Sends from ${serverMail.from ?? 'your company mailbox'} with the file attached.`
                : 'Company SMTP is not connected yet — prepare the file and open your mail app, or connect outgoing email in Settings → Organisation.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {formatPicker}
            <div className="space-y-1.5">
              <Label htmlFor="doc-email-to">To</Label>
              <Input
                id="doc-email-to"
                type="email"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="name@email.com"
              />
              <p className="text-xs text-muted-foreground">
                {savedRecipient
                  ? `Sends to the email saved on this customer: ${savedRecipient}`
                  : 'This customer has no email saved. Add one on the customer, and Send will use it.'}
              </p>
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
                rows={6}
                className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-[0.8125rem] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
              />
            </div>
            {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
            {!serverMail?.configured ? (
              <p className="text-xs text-muted-foreground">
                <Link href="/settings/organization" className="underline underline-offset-2">
                  Connect outgoing email
                </Link>{' '}
                to send directly from the company mailbox (Gmail or domain).
              </p>
            ) : null}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setEmailOpen(false)}>
              Close
            </Button>
            {serverMail?.configured ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void shareFile('email')}
                  disabled={busy}
                >
                  Open mail app
                </Button>
                <Button type="button" onClick={() => void sendViaServer()} disabled={busy}>
                  {busy ? <Loader2Icon className="animate-spin" /> : <MailIcon />}
                  Send {attachFormat === 'excel' ? 'Excel' : 'PDF'}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => void shareFile('email')} disabled={busy}>
                {busy ? <Loader2Icon className="animate-spin" /> : <MailIcon />}
                Prepare {attachFormat === 'excel' ? 'Excel' : 'PDF'} & email
              </Button>
            )}
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
              Choose PDF or Excel, then open WhatsApp. Use a number with country code (no +).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {formatPicker}
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
                rows={5}
                className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-[0.8125rem] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
              />
            </div>
            {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWaOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={() => void shareFile('whatsapp')} disabled={busy}>
              {busy ? <Loader2Icon className="animate-spin" /> : <MessageCircleIcon />}
              Prepare {attachFormat === 'excel' ? 'Excel' : 'PDF'} & WhatsApp
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

function clip(value: string, format: AttachFormat): string {
  const hint =
    format === 'excel'
      ? '\n\nAttach the Excel file that downloaded.'
      : '\n\nAttach the PDF that downloaded.'
  if (value.length <= 1400) return `${value}${hint}`
  return `${value.slice(0, 1300)}${hint}`
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf?.[1]) return decodeURIComponent(utf[1])
  const plain = header.match(/filename="?([^";]+)"?/i)
  return plain?.[1] ?? null
}
