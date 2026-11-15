'use client'

import { useState } from 'react'

import { FormCustomizePanel } from '@/components/forms/form-customize-panel'
import type { FormCustomizationProps } from '@/lib/form-customization-props'
import type { FormColumnDef, FormFieldDef } from '@/lib/form-field-catalog'
import type { FormTemplate } from '@/lib/form-templates'

/**
 * Settings → Templates: manage company field/column visibility for one form family.
 * Reuses the same Customize controls and persistence as the live entry forms.
 */
export function CompanyFormFieldsPanel({
  title,
  description,
  customization,
  fieldCatalog,
  columnCatalog,
  categoryColumnCatalog,
  layoutOptions,
}: {
  title: string
  description: string
  customization: FormCustomizationProps
  fieldCatalog: FormFieldDef[]
  columnCatalog: FormColumnDef[]
  categoryColumnCatalog?: FormColumnDef[]
  layoutOptions?: readonly { id: string; label: string; blurb: string }[]
}) {
  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <CompanyFormFieldsEditor
        key={`${customization.activeId}:${customization.templates.map((row) => row.id).join(',')}`}
        customization={customization}
        fieldCatalog={fieldCatalog}
        columnCatalog={columnCatalog}
        categoryColumnCatalog={categoryColumnCatalog}
        layoutOptions={layoutOptions}
      />
    </section>
  )
}

function CompanyFormFieldsEditor({
  customization,
  fieldCatalog,
  columnCatalog,
  categoryColumnCatalog,
  layoutOptions,
}: {
  customization: FormCustomizationProps
  fieldCatalog: FormFieldDef[]
  columnCatalog: FormColumnDef[]
  categoryColumnCatalog?: FormColumnDef[]
  layoutOptions?: readonly { id: string; label: string; blurb: string }[]
}) {
  const [draft, setDraft] = useState<FormTemplate>(customization.active)
  const [activeId, setActiveId] = useState(customization.activeId)

  return (
    <FormCustomizePanel
      family={customization.family}
      templates={customization.templates}
      activeId={activeId}
      draft={draft}
      onDraftChange={(next) => {
        setDraft(next)
        setActiveId(next.id)
      }}
      fieldCatalog={fieldCatalog}
      columnCatalog={columnCatalog}
      categoryColumnCatalog={categoryColumnCatalog}
      canManage={customization.canManage}
      layoutOptions={layoutOptions}
      className="justify-start"
    />
  )
}
