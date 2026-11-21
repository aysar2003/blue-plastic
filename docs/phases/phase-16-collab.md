# Phase 16 — Collab apps

**Status:** Complete (FULL) — Wave C 2026-11-21

## Modules

| App | Route | Notes |
| --- | --- | --- |
| Sign | `/sign` | Request + mark signed; attach to a **sales or purchase document id**; link PDFs via Documents |
| Appointments | `/appointments` | Slots; optional `projectId` or `serviceJobId`; overlap refused; creates calendar event |
| Discuss | `/discuss` | Channels + messages |
| Planning | `/planning` | Week grid from project tasks + employees; assign hours creates a **project time entry** (or a `TIMESHEET_STUB` note when the employee has no login) |
| Surveys | `/surveys` | Text questions + responses |

Enable under **Settings → Apps & features** (opt-in like Knowledge).

## Migration

`20261121191000_wave_c_deepen`
