# Phase 15 — HRIS

**Status:** Complete (FULL) — Wave C 2026-11-21

## Shipped

- Employee `lifecycleStatus` (DRAFT / ACTIVE / LEFT); payroll runs exclude LEFT.
- Recruitment: job openings, applicants, hire → employee (`/employees/recruitment`).
- **Hire path (FULL):** hire from Offer creates an **OPEN** employment contract, copies wage onto the employee card, and the person is payroll-eligible (`ACTIVE` + wage/open contract).
- Appraisals service (score + notes on employee).
- Contract wage sync on OPEN contract (existing `employee-hr.service` + contracts board).
- **Leave / attendance hours file** — CSV of approved leave (days × hours/day) and attendance worked hours (`/api/employees/hours`).
- **Payroll CSV** uses the organisation localisation pack headers (`payrollStatutoryToCsvForPack`, statutory export `format=csv`).

## Enterprise deferrals

- Full applicant tracking, onboarding portals, competency matrices.

## Migration

`20261121191000_wave_c_deepen`
