# Phase 54 — Cooperative patronage

**Status:** Complete (FULL)

## Shipped

1. `Shareholder.memberKind`, optional `customerId`.
2. `patronage.allocate` + button on `/accounting/equity`.
3. **Wave E (2026-11-21)** — Allocation from member purchases posts a `PATRONAGE` equity event per member and a member CSV (`/api/equity/patronage`).

## Migration

`20261114220000_phase51_60_wave_cd`

Wave E: `20261121201000_wave_e_deepen` (`EquityEventKind.PATRONAGE`; `equity_events.bankAccountId` optional)
