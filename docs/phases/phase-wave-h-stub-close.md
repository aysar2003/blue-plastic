# Wave H — Stub close (planning timesheets + job cost vs charge)

**Status:** Complete (FULL) — 2026-11-25  
**Migration:** `20261125120000_wave_h_stub_close`

## Shipped

1. **Planning → real timesheets** — Assigning hours to a task always creates a `ProjectTimeEntry`. Employees without a login use `employeeId` (nullable `userId`). No more `TIMESHEET_STUB` notes. Cost rate defaults from the wage card (hourly / daily÷8 / monthly÷176).
2. **Job P&L cost vs charge** — Report and project strip show **Labour cost** (hours × costRate, fallback billableRate) and **Labour charge** (hours × billableRate). Profit subtracts cost only.
3. **Wave shipping labels** — Documented CSV export (`/api/waves/[id]/labels?format=csv`); JSON payload remains for machine use.
4. **Sign outbound** — Comment/docs clarify real POST + HMAC (not a stub); failures return `{ ok: false }`.
5. **Docs truth** — Phase 9 migration note, phase 53 title, Wave B “in progress”, Wave C timesheet stub wording cleaned.

## Verify

```bash
pnpm exec vitest run lib/project-profitability.test.ts tests/wave-h-stub-close.test.ts
pnpm db:deploy
```

## Explicitly out

Peppol / live government e-filing (phases 27/40 terminal Toward FULL), WIP revenue recognition, multi-currency job books.
