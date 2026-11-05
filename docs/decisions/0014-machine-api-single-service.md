# ADR-0014 — Machine API and MCP share the service layer

**Status:** accepted · 2026-11-05

## The problem

Phase 22 adds a public machine surface so agents and integrations can drive Som
ERP. If routes re-implement posting, allocation, or stock rules, a defect fixed
in the UI will still be wrong on the API — and the next AI agent will teach the
wrong behaviour.

## The decision

1. **Capabilities** declare which permission and Zod schema gate a call, and
   which existing service function runs it.
2. **`/api/v1` and MCP** only authenticate (API key → `OrgContext`), validate,
   call the service, and serialise the result.
3. **No business rules in route handlers.** A fix lands once in
   `server/services/*` or `server/accounting/*`.

## Consequences

- OpenAPI and MCP tool lists are generated from the same registry.
- Adding a capability is a registry entry + a thin route, not a second domain.
- Keys carry permission scopes; they never bypass RBAC.
