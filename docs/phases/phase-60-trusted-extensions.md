# Phase 60 — Trusted extensions

**Status:** Complete (FULL)

## Shipped

1. `lib/erp/extensions/registry.ts` allowlist + `assertTrustedExtension`.
2. **Deepen (2026-11-15)** — `version` + `requiredPermissions` on registry rows; merge `Organization.trustedExtensions` allowlist; list in Settings → Organisation.
3. Optional `extensionId` query on `GET /api/v1/capabilities`.
4. Vitest rejects unknown ids.
5. **Wave F (2026-11-21)** — editable org allowlist (add/remove extras, first-party rows stay built-in). Capability probe page `Settings → Extensions` (`/settings/extensions`) and `GET /api/v1/extensions/probe?extensionId=`. Probe helper `lib/erp/extensions/probe.ts`.

## Migration

None (JSON on `Organization.trustedExtensions`).
