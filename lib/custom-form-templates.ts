/**
 * Templates the company adds itself under Settings → Templates → My templates.
 * Metadata lives in this browser; PDF/image bytes live in IndexedDB
 * (`lib/custom-template-media.ts`). Built-in layouts stay in sales-form-templates.
 */

import type { TemplateMediaMeta } from '@/lib/custom-template-media'
import {
  DEFAULT_DOCUMENT_TEMPLATE,
  parseDocumentTemplate,
  type DocumentTemplate,
} from '@/lib/document-template'
import { parseTemplateOverlay, type TemplateOverlay } from '@/lib/template-overlay'

export const CUSTOM_FORM_TEMPLATES_KEY = 'bpc.customFormTemplates'

export type CustomFormTemplateKind =
  | 'document'
  | 'invoice-form'
  | 'sales-receipt-form'
  | 'sales-form'
  | 'media'
  | 'other'

export type CustomFormTemplate = {
  id: string
  name: string
  kind: CustomFormTemplateKind
  /** Free note — what this paper is for. */
  note: string
  createdAt: string
  /** When kind is document — full invoice/statement paper. */
  document?: DocumentTemplate
  /** When kind is a form layout — which built-in layout id to apply. */
  formLayoutId?: string
  /** PDF or image attached to this template (bytes in IndexedDB under `id`). */
  media?: TemplateMediaMeta
  /** Draggable styled blocks drawn on the uploaded paper. */
  overlay?: TemplateOverlay
}

export const CUSTOM_FORM_TEMPLATE_KINDS: { id: CustomFormTemplateKind; label: string }[] = [
  { id: 'document', label: 'Invoice & statement paper' },
  { id: 'invoice-form', label: 'Invoice form layout' },
  { id: 'sales-receipt-form', label: 'Sales receipt form' },
  { id: 'sales-form', label: 'Other sales form' },
  { id: 'media', label: 'PDF or image paper' },
  { id: 'other', label: 'Other / coming soon' },
]

function parseMedia(raw: unknown): TemplateMediaMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const item = raw as Record<string, unknown>
  const kind = item.kind === 'pdf' || item.kind === 'image' ? item.kind : null
  const contentType = typeof item.contentType === 'string' ? item.contentType.slice(0, 80) : ''
  const fileName = typeof item.fileName === 'string' ? item.fileName.trim().slice(0, 120) : ''
  const sizeBytes = typeof item.sizeBytes === 'number' && item.sizeBytes > 0 ? Math.floor(item.sizeBytes) : 0
  if (!kind || !contentType || !fileName || !sizeBytes) return undefined
  return { kind, contentType, fileName, sizeBytes }
}

export function parseCustomFormTemplates(raw: string | null | undefined): CustomFormTemplate[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data
      .flatMap((row) => {
        if (!row || typeof row !== 'object') return []
        const item = row as Record<string, unknown>
        const id = typeof item.id === 'string' ? item.id.slice(0, 40) : ''
        const name = typeof item.name === 'string' ? item.name.trim().slice(0, 80) : ''
        if (!id || !name) return []
        const kind = CUSTOM_FORM_TEMPLATE_KINDS.some((entry) => entry.id === item.kind)
          ? (item.kind as CustomFormTemplateKind)
          : 'other'
        const note = typeof item.note === 'string' ? item.note.trim().slice(0, 400) : ''
        const createdAt =
          typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : new Date().toISOString()
        const media = parseMedia(item.media)
        const overlay = parseTemplateOverlay(item.overlay)
        const document =
          kind === 'document' && item.document != null
            ? parseDocumentTemplate(item.document)
            : kind === 'document'
              ? { ...DEFAULT_DOCUMENT_TEMPLATE, banks: [] }
              : undefined
        const formLayoutId =
          typeof item.formLayoutId === 'string' ? item.formLayoutId.trim().slice(0, 40) : undefined
        return [
          {
            id,
            name,
            kind,
            note,
            createdAt,
            document,
            formLayoutId,
            media,
            overlay: overlay.blocks.length > 0 ? overlay : undefined,
          },
        ]
      })
      .slice(0, 40)
  } catch {
    return []
  }
}

export function serializeCustomFormTemplates(templates: CustomFormTemplate[]): string {
  return JSON.stringify(templates.slice(0, 40))
}

export function newCustomTemplateId() {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
