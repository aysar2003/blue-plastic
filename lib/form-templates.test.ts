import { describe, expect, it } from 'vitest'

import {
  SYSTEM_FORM_TEMPLATE_ID,
  formFamilyKey,
  parseOrgFormTemplates,
  removeTemplateInOrg,
  resolveFormTemplates,
  setActiveInOrg,
  upsertTemplateInOrg,
  type FormTemplate,
} from '@/lib/form-templates'
import { isColumnVisible, isFieldVisible } from '@/lib/form-field-catalog'

describe('form templates', () => {
  it('seeds system default when org has no saved templates', () => {
    const family = formFamilyKey('sales', 'SALES_RECEIPT')
    const resolved = resolveFormTemplates({ active: {}, templates: {} }, family)
    expect(resolved.activeId).toBe(SYSTEM_FORM_TEMPLATE_ID)
    expect(resolved.active.name).toBe('System default')
    expect(resolved.active.fields.project).toBe(true)
    expect(resolved.active.columns.item).toBe(true)
    expect(resolved.active.columns.store).toBe(true)
  })

  it('upserts a company template and can make it active', () => {
    const family = formFamilyKey('sales', 'SALES_RECEIPT')
    const custom: FormTemplate = {
      id: 'tmpl-1',
      name: 'Counter',
      layoutId: 'sheet',
      fields: { project: false, reference: true },
      columns: { item: true, description: true, qty: true, rate: true, amount: true, store: false, tax: true },
    }
    const next = upsertTemplateInOrg({ active: {}, templates: {} }, family, custom, true)
    const resolved = resolveFormTemplates(next, family)
    expect(resolved.activeId).toBe('tmpl-1')
    expect(resolved.active.fields.project).toBe(false)
    expect(resolved.templates).toHaveLength(2)
  })

  it('keeps item and amount locked on when parsing', () => {
    const family = formFamilyKey('purchase', 'BILL')
    const raw = {
      active: { [family]: 'tmpl-2' },
      templates: {
        [family]: [
          {
            id: 'tmpl-2',
            name: 'Lean bill',
            fields: { project: false },
            columns: { item: false, amount: false, description: false, qty: true, rate: true, store: false, tax: false },
          },
        ],
      },
    }
    const org = parseOrgFormTemplates(raw)
    const resolved = resolveFormTemplates(org, family)
    expect(resolved.active.columns.item).toBe(true)
    expect(resolved.active.columns.amount).toBe(true)
    expect(resolved.active.columns.description).toBe(false)
  })

  it('switches active back to system when deleting the active company template', () => {
    const family = formFamilyKey('sales', 'INVOICE')
    let org = upsertTemplateInOrg(
      { active: {}, templates: {} },
      family,
      {
        id: 'gone',
        name: 'Temp',
        fields: {},
        columns: {},
      },
      true,
    )
    org = removeTemplateInOrg(org, family, 'gone')
    const resolved = resolveFormTemplates(org, family)
    expect(resolved.activeId).toBe(SYSTEM_FORM_TEMPLATE_ID)
  })

  it('setActiveInOrg ignores unknown ids', () => {
    const family = formFamilyKey('sales', 'INVOICE')
    const org = setActiveInOrg({ active: {}, templates: {} }, family, 'missing')
    expect(org.active[family]).toBeUndefined()
  })

  it('visibility helpers default to visible', () => {
    expect(isFieldVisible(undefined, 'project')).toBe(true)
    expect(isColumnVisible({ store: false }, 'store')).toBe(false)
    expect(isColumnVisible({ store: false }, 'qty')).toBe(true)
  })
})
