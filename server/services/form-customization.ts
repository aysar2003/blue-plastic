import 'server-only'

import type { FormCustomizationProps } from '@/lib/form-customization-props'
import {
  canManageFormFamily,
  formFamilyKey,
  resolveFormTemplates,
  type FormTemplateSide,
} from '@/lib/form-templates'
import type { OrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'

export async function loadFormCustomization(
  ctx: OrgContext,
  side: FormTemplateSide,
  type: string,
): Promise<FormCustomizationProps> {
  const family = formFamilyKey(side, type)
  const org = await organizationService.getFormTemplates(ctx)
  const resolved = resolveFormTemplates(org, family)
  return {
    family,
    templates: resolved.templates,
    activeId: resolved.activeId,
    active: resolved.active,
    canManage: canManageFormFamily(ctx.permissions, family),
  }
}
