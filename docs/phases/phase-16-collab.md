# Phase 16 — Collab apps

**Status:** Complete (FULL) — Wave C 2026-11-21 · Wave H 2026-11-25

## Modules

| App | Route | Notes |
| --- | --- | --- |
| Sign | `/sign` | Request + mark signed; attach to a **sales or purchase document id**; link PDFs via Documents |
| Appointments | `/appointments` | Slots; optional `projectId` or `serviceJobId`; overlap refused; creates calendar event |
| Discuss | `/discuss` | Channels + messages |
| Planning | `/planning` | Week grid from project tasks + employees; assign hours always creates a **project time entry** (via `userId` and/or `employeeId` when the card has no login) |
| Surveys | `/surveys` | Text questions + responses |

Enable under **Settings → Apps & features** (opt-in like Knowledge).

## Migration

`20261121191000_wave_c_deepen` · `20261125120000_wave_h_stub_close` (nullable `userId` + `employeeId` on time entries)
