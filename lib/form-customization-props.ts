import type { FormFamilyKey, FormTemplate } from '@/lib/form-templates'

/** Passed from server pages into DocumentForm / BillForm. */
export type FormCustomizationProps = {
  family: FormFamilyKey
  templates: FormTemplate[]
  activeId: string
  active: FormTemplate
  canManage: boolean
}
