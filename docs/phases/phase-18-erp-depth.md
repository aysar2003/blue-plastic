# Phase 18 — Lite modules to full SME ERP depth

**Status:** Complete

## Why

Phases 13–17 shipped working stubs (Sign, Discuss, Surveys, Planning, ATS, equity, consolidation). Daily books were already complete. This phase replaces those stubs with real stage rules, public signing, CRM pipeline, multi-level BOM explode, and cap-table ownership — plus general and specific tests.

## Shipped

| Area | What is now complete |
| --- | --- |
| Sign | Token link, typed signature, decline, cancel, public `/sign-request/[token]` |
| Discuss | Threads (replies), pins, unique channel names |
| Appointments | Type picker, overlap refuse, complete / no-show / cancel |
| Planning | Persist hours per employee per day; match tasks via login user |
| Surveys | Multi-question, score/text, close, tally |
| HRIS | SCREENING → INTERVIEW → OFFER → hire; reject; reopen opening; appraisal goals |
| CRM | Opportunities + follow-up activities under Customers → Pipeline |
| Equity | Ownership % derived from shares |
| Consolidation | Group P&L **and** assets / liabilities / equity |
| MRP | Nested BOM explode + shortage vs on-hand (`materialsPlan`) |

## Tests

- General: `tests/erp-readiness.test.ts` — pages exist, stub copy gone, eight loops named.
- Specific: `tests/erp-lite-complete.test.ts` — pipeline, overlap, BOM, cap table, CRM, sign, surveys.
- Cycle checklist extended in `tests/e2e-accounting-cycle.test.ts`.

## Still not this product

FX hedging, restaurant IoT POS, app marketplace, WMS robotics, DocuSign/Slack clones. Backup/restore and customer portal were already in place from earlier phases.
