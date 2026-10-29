'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Renders PDF pages onto canvas with pdf.js so preview works without the
 * browser's built-in PDF plugin (often blank in embedded / Electron views).
 */
export function PdfCanvasPreview({ data, title }: { data: ArrayBuffer; title: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    // Copy bytes — pdf.js may transfer/detach the buffer.
    const bytes = data.slice(0)
    // pdf.js typing across dynamic import is loose; keep a destroy handle only.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PDFDocumentLoadingTask
    let loadingTask: any = null

    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        loadingTask = pdfjs.getDocument({ data: bytes })
        const pdf = await loadingTask.promise
        if (cancelled) {
          void loadingTask.destroy()
          return
        }
        setPageCount(pdf.numPages)

        const maxWidth = Math.min(host.clientWidth || 720, 900)

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) break
          const page = await pdf.getPage(pageNumber)
          const base = page.getViewport({ scale: 1 })
          const scale = Math.min(1.6, maxWidth / base.width)
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          const dpr = window.devicePixelRatio || 1
          const output = page.getViewport({ scale: scale * dpr })
          canvas.width = Math.ceil(output.width)
          canvas.height = Math.ceil(output.height)
          canvas.style.width = `${Math.ceil(viewport.width)}px`
          canvas.style.height = `${Math.ceil(viewport.height)}px`
          canvas.style.maxWidth = '100%'
          canvas.style.display = 'block'
          canvas.style.margin = '0 auto 12px'
          canvas.style.background = '#fff'
          canvas.style.boxShadow = '0 1px 3px rgb(0 0 0 / 0.15)'
          canvas.dir = 'ltr'
          canvas.setAttribute('aria-label', `${title} — page ${pageNumber}`)
          host.appendChild(canvas)

          const renderTask = page.render({
            canvas,
            viewport: output,
            annotationMode: pdfjs.AnnotationMode.DISABLE,
          })
          await renderTask.promise
        }

        void pdf.cleanup()
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not render this PDF.')
        }
      }
    })()

    return () => {
      cancelled = true
      void loadingTask?.destroy().catch(() => undefined)
      host.replaceChildren()
    }
  }, [data, title])

  if (error) {
    return (
      <div className="flex h-[min(70vh,44rem)] flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground">Use Download to open the file on your computer.</p>
      </div>
    )
  }

  return (
    <div className="max-h-[min(75vh,48rem)] overflow-y-auto px-3 py-4" dir="ltr">
      <div ref={hostRef} className="mx-auto w-full max-w-[56rem]" />
      {pageCount === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Rendering PDF…</p>
      ) : null}
    </div>
  )
}
