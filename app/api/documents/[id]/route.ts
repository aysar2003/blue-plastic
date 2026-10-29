import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { streamDocument } from '@/server/files/workspace-documents'

export const dynamic = 'force-dynamic'
/** Large PDFs stream from R2; allow enough time for slow links. */
export const maxDuration = 60

function contentDisposition(filename: string, asAttachment: boolean) {
  const safe = filename.replace(/[\r\n"]/g, '') || 'document'
  const encoded = encodeURIComponent(safe).replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  const kind = asAttachment ? 'attachment' : 'inline'
  return `${kind}; filename="${safe}"; filename*=UTF-8''${encoded}`
}

/** Download / preview a company library file. Org members with docs:read only. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOrgContext('docs:read')
    const { id } = await params
    const { file, body, contentLength } = await streamDocument(ctx, id)
    const asAttachment = new URL(request.url).searchParams.get('download') === '1'
    const headers = new Headers({
      'Content-Type': file.contentType,
      'Content-Disposition': contentDisposition(file.originalName, asAttachment),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    })
    if (contentLength != null) headers.set('Content-Length', String(contentLength))
    return new NextResponse(body, { headers })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      )
    }
    console.error('[api/documents]', error)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Request failed.' } }, { status: 500 })
  }
}
