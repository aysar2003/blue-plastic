# Phase 22 — Platform + AI surface (L0 / L9)

**Status:** Complete

## Shipped

- Layer contract: [docs/06-erp-layers.md](../06-erp-layers.md), `ERP_LAYERS` in `lib/erp/readiness.ts`.
- Capability registry: `lib/erp/capabilities.ts` (id, layer, permission, Zod, http path, service).
- OpenAPI 3 from the registry: `GET /api/v1/openapi`.
- Org-scoped API keys (hashed secret, scopes): Settings → API keys; `Authorization: Bearer som_…`.
- Thin `/api/v1/*` adapters → existing services.
- MCP tool list + call: `GET /api/v1/mcp/tools`, `POST /api/v1/mcp/call`.
- ADR-0014 — single service surface for UI / API / MCP.
- Tests: capability ↔ OpenAPI sync, scope authz, registry happy-path wiring.

## Explicitly out

AL FURAAT migrate WIP, new accounting rules, SSO/SAML, untrusted plugins, MES, full BI warehouse.
