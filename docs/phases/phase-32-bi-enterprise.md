# Phase 32 — BI enterprise (L8)

**Status:** Complete (FULL)

## Shipped

1. **MetricSnapshot** daily capture from business-overview / home KPIs.
2. Cron `/api/cron/metric-snapshots`.
3. Dashboard SPARK tiles prefer snapshot series when present.
4. Report pack email failure marks run `FAILED` with message.
5. **Wave D extra keys** — `stockValue`, `openJobs`, `vanStock` captured with the daily snapshot.

## Explicitly out

Power BI / data lake, Slack/Drive delivery channels.

## Verify

```bash
pnpm exec vitest run tests/wave-d-deepen
```
