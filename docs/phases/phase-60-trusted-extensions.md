# Phase 60 — Trusted extensions LITE

**Status:** Complete (LITE)

## Shipped

1. `lib/erp/extensions/registry.ts` allowlist + `assertTrustedExtension`.
2. **Deepen (2026-11-15)** — `version` + `requiredPermissions` on registry rows; merge `Organization.trustedExtensions` allowlist; read-only list in Settings → Organisation.
2. Optional `extensionId` query on `GET /api/v1/capabilities`.
3. Vitest rejects unknown ids.

## Migration

None.