import 'server-only'

import {
  DEFAULT_FEATURE_FLAGS,
  parseFeatureFlags,
} from '@/lib/feature-flags'
import { isPermission, type Permission } from '@/lib/permissions-catalog'
import type { OrgContext } from '@/server/auth/context'
import { unauthenticated, forbidden } from '@/server/errors'
import * as apiKeyService from '@/server/services/api-key.service'

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

/**
 * Build an OrgContext from an organisation API key.
 * Permissions = key scopes (already validated as staff permissions at create time).
 */
export async function requireApiKeyContext(
  request: Request,
  permission?: Permission,
): Promise<OrgContext> {
  const token = bearerToken(request)
  if (!token) throw unauthenticated('Missing API key. Use Authorization: Bearer som_…')

  const row = await apiKeyService.authenticateApiKey(token)
  if (!row) throw unauthenticated('Invalid or revoked API key.')

  const scopes = row.scopes.filter(isPermission)
  const permissions = new Set<Permission>(scopes)
  if (permission && !permissions.has(permission)) {
    throw forbidden(`This API key requires the "${permission}" scope.`)
  }

  const { organization: org, createdBy } = row
  const { logoStorageKey, featureFlags, ...orgFields } = org

  return {
    orgId: org.id,
    userId: createdBy.id,
    role: 'CUSTOM',
    permissions,
    features: parseFeatureFlags(featureFlags) ?? DEFAULT_FEATURE_FLAGS,
    organization: {
      ...orgFields,
      hasLogo: Boolean(logoStorageKey),
    },
    user: {
      id: createdBy.id,
      name: createdBy.name,
      email: createdBy.email,
      image: createdBy.image,
    },
    isSystemOwner: false,
    canConnect: false,
    portalCustomerId: null,
  }
}
