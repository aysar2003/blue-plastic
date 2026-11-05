# Phase 26 — Scheduled report packs (L8)

**Status:** Complete

## Shipped

- `ReportPack` / `ReportPackRun` schema + migration `20261105220000_phase26_report_packs`.
- Compose standard report keys into one CSV (`lib/report-packs.ts` + service).
- UI: Reports → Report packs (create, run now, download runs).
- Optional email after run (company SMTP); cron `POST /api/cron/report-packs` with `CRON_SECRET`.
- Vitest for key validation, cadence, and CSV compose.

## Explicitly out

Interactive BI dashboards, third-party delivery (Slack/Drive), nested report variants beyond catalogue keys.
