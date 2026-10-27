/**
 * Company-wide form templates: which optional fields and line columns appear on
 * sales / purchase entry forms. Stored as JSON on the organisation.
 *
 * The built-in `system` template is always available. Company templates are
 * named copies every user of the company can switch to.
 */

import {
  defaultColumnVisibility,
  defaultFieldVisibility,
  PURCHASE_CATEGORY_COLUMNS,
  PURCHASE_FORM_COLUMNS,
  PURCHASE_FORM_FIELDS,
  SALES_FORM_COLUMNS,
  SALES_FORM_FIELDS,
} from '@/lib/form-field-catalog'
import type { SalesFormTemplateId } from '@/lib/sales-form-templates'
import { isSalesFormTemplateId, isInvoiceFormTemplateId, isSalesReceiptFormTemplateId } from '@/lib/sales-form-templates'

export const SYSTEM_FORM_TEMPLATE_ID = 'system'

export type FormTemplateSide = 'sales' | 'purchase'

export type FormFamilyKey = `${FormTemplateSide}:${string}`

export type FormTemplate = {
  id: string
  name: string
  /** Sales layout skin when the form type allows it. */
  layoutId?: string
  fields: Record<string, boolean>
  columns: Record<string, boolean>
  /** Purchase category-table column visibility. */
  categoryColumns?: Record<string, boolean>
}

export type OrgFormTemplates = {
  /** Family key → active template id (company default for that form). */
  active: Record<string, string>
  /** Family key → templates (system is merged in at read time, not stored). */
  templates: Record<string, FormTemplate[]>
}

export function formFamilyKey(side: FormTemplateSide, type: string): FormFamilyKey {
  return `${side}:${type}`
}

export function parseFormFamilyKey(key: string): { side: FormTemplateSide; type: string } | null {
  const match = /^(sales|purchase):([A-Z0-9_]+)$/.exec(key)
  if (!match) return null
  return { side: match[1] as FormTemplateSide, type: match[2] }
}

function systemTemplateFor(side: FormTemplateSide): FormTemplate {
  if (side === 'sales') {
    return {
      id: SYSTEM_FORM_TEMPLATE_ID,
      name: 'System default',
      layoutId: 'sheet',
      fields: defaultFieldVisibility(SALES_FORM_FIELDS),
      columns: defaultColumnVisibility(SALES_FORM_COLUMNS),
    }
  }
  return {
    id: SYSTEM_FORM_TEMPLATE_ID,
    name: 'System default',
    fields: defaultFieldVisibility(PURCHASE_FORM_FIELDS),
    columns: defaultColumnVisibility(PURCHASE_FORM_COLUMNS),
    categoryColumns: defaultColumnVisibility(PURCHASE_CATEGORY_COLUMNS),
  }
}

function sanitizeVisibility(
  raw: unknown,
  defaults: Record<string, boolean>,
  lockedIds: string[] = [],
): Record<string, boolean> {
  const next = { ...defaults }
  if (!raw || typeof raw !== 'object') return next
  const data = raw as Record<string, unknown>
  for (const key of Object.keys(defaults)) {
    if (lockedIds.includes(key)) {
      next[key] = true
      continue
    }
    if (typeof data[key] === 'boolean') next[key] = data[key]
  }
  return next
}

function parseOneTemplate(raw: unknown, side: FormTemplateSide): FormTemplate | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const id = typeof item.id === 'string' ? item.id.trim().slice(0, 40) : ''
  const name = typeof item.name === 'string' ? item.name.trim().slice(0, 80) : ''
  if (!id || !name || id === SYSTEM_FORM_TEMPLATE_ID) return null

  const defaults = systemTemplateFor(side)
  const lockedColumns = side === 'sales' ? ['item', 'amount'] : ['item', 'amount']
  const fields = sanitizeVisibility(item.fields, defaults.fields)
  const columns = sanitizeVisibility(item.columns, defaults.columns, lockedColumns)
  const categoryColumns =
    side === 'purchase'
      ? sanitizeVisibility(item.categoryColumns, defaults.categoryColumns ?? {}, ['category', 'amount'])
      : undefined

  let layoutId: string | undefined
  if (typeof item.layoutId === 'string') {
    const candidate = item.layoutId.trim().slice(0, 40)
    if (
      isSalesFormTemplateId(candidate) ||
      isInvoiceFormTemplateId(candidate) ||
      isSalesReceiptFormTemplateId(candidate)
    ) {
      layoutId = candidate
    }
  }

  return {
    id,
    name,
    layoutId: side === 'sales' ? layoutId ?? 'sheet' : undefined,
    fields,
    columns,
    categoryColumns,
  }
}

export function parseOrgFormTemplates(raw: unknown): OrgFormTemplates {
  const empty: OrgFormTemplates = { active: {}, templates: {} }
  if (!raw || typeof raw !== 'object') return empty
  const data = raw as Record<string, unknown>

  const active: Record<string, string> = {}
  if (data.active && typeof data.active === 'object') {
    for (const [key, value] of Object.entries(data.active as Record<string, unknown>)) {
      if (!parseFormFamilyKey(key)) continue
      if (typeof value === 'string' && value.trim()) active[key] = value.trim().slice(0, 40)
    }
  }

  const templates: Record<string, FormTemplate[]> = {}
  if (data.templates && typeof data.templates === 'object') {
    for (const [key, value] of Object.entries(data.templates as Record<string, unknown>)) {
      const parsed = parseFormFamilyKey(key)
      if (!parsed || !Array.isArray(value)) continue
      templates[key] = value
        .map((row) => parseOneTemplate(row, parsed.side))
        .filter((row): row is FormTemplate => Boolean(row))
        .slice(0, 40)
    }
  }

  return { active, templates }
}

/** System + company templates for one family, with the company default resolved. */
export function resolveFormTemplates(
  org: OrgFormTemplates,
  family: FormFamilyKey,
): { templates: FormTemplate[]; activeId: string; active: FormTemplate } {
  const parsed = parseFormFamilyKey(family)
  const side = parsed?.side ?? 'sales'
  const system = systemTemplateFor(side)
  const company = org.templates[family] ?? []
  const templates = [system, ...company]
  const activeId =
    org.active[family] && templates.some((row) => row.id === org.active[family])
      ? org.active[family]
      : SYSTEM_FORM_TEMPLATE_ID
  const active = templates.find((row) => row.id === activeId) ?? system
  return { templates, activeId, active }
}

export function upsertTemplateInOrg(
  org: OrgFormTemplates,
  family: FormFamilyKey,
  template: FormTemplate,
  makeActive: boolean,
): OrgFormTemplates {
  const parsed = parseFormFamilyKey(family)
  if (!parsed) return org
  if (template.id === SYSTEM_FORM_TEMPLATE_ID) return org

  const cleaned = parseOneTemplate({ ...template, id: template.id, name: template.name }, parsed.side)
  if (!cleaned) return org

  const list = [...(org.templates[family] ?? [])]
  const index = list.findIndex((row) => row.id === cleaned.id)
  if (index >= 0) list[index] = cleaned
  else list.push(cleaned)

  return {
    active: makeActive ? { ...org.active, [family]: cleaned.id } : { ...org.active },
    templates: { ...org.templates, [family]: list },
  }
}

export function setActiveInOrg(
  org: OrgFormTemplates,
  family: FormFamilyKey,
  templateId: string,
): OrgFormTemplates {
  const { templates } = resolveFormTemplates(org, family)
  if (!templates.some((row) => row.id === templateId)) return org
  return {
    ...org,
    active: { ...org.active, [family]: templateId },
  }
}

export function removeTemplateInOrg(
  org: OrgFormTemplates,
  family: FormFamilyKey,
  templateId: string,
): OrgFormTemplates {
  if (templateId === SYSTEM_FORM_TEMPLATE_ID) return org
  const list = (org.templates[family] ?? []).filter((row) => row.id !== templateId)
  const activeId = org.active[family]
  const nextActive =
    activeId === templateId ? SYSTEM_FORM_TEMPLATE_ID : activeId
  return {
    active: { ...org.active, [family]: nextActive ?? SYSTEM_FORM_TEMPLATE_ID },
    templates: { ...org.templates, [family]: list },
  }
}

export type SalesLayoutId = SalesFormTemplateId | 'invoice'

export function layoutIdFromTemplate(template: FormTemplate | undefined): string {
  return template?.layoutId ?? 'sheet'
}

/** Sales staff may edit sales form templates; purchasing staff for purchase. Admins either. */
export function canManageFormFamily(
  permissions: ReadonlySet<string>,
  family: string,
): boolean {
  if (permissions.has('org:update')) return true
  const parsed = parseFormFamilyKey(family)
  if (!parsed) return false
  if (parsed.side === 'sales') return permissions.has('invoice:create')
  return permissions.has('bill:create')
}
