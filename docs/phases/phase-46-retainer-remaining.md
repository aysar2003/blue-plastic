# Phase 46 — Retainer remaining

**Status:** Complete (LITE)

## Shipped

1. `projects.retainerRemaining`.
2. `billRetainer` decrements; `billWipFromTime` blocks when WIP > remaining.
3. UI `/projects/wip` shows retainer left.
4. **Deepen (2026-11-15)** — Low-watermark banner when retainer remaining is low.

## Migration

`20261114200000_phase41_50_wave_b`