# Phase 48b — School SIS deepen

**Status:** Complete (FULL)

## Goal

Turn education from fee-only into a practical school management desk for a principal: classes, roster, attendance, grades, report cards — while keeping fee → ledger.

## Shipped

1. Schema: `SchoolClass`, `SchoolClassMember`, `StudentAttendanceDay`, `GradeItem`, `GradeEntry` + `AttendanceMark`.
2. Migration `20261122140000_school_sis_deepen`.
3. Helpers `lib/erp/school-sis.ts` + vitest.
4. Service `server/services/school-sis.service.ts`.
5. UI: `/education/classes`, `/education/classes/[id]`, `/education/attendance`, `/education/grades`, `/education/report-cards/[enrollmentId]`.
6. Portal: `/portal/report-cards` for guardians/students.
7. School + university packs updated (checklist + inScope).

## Follow-on

Timetable, assignments, transport, hostel, announcements, and discipline shipped in [phase-48c-school-ops-full.md](./phase-48c-school-ops-full.md).
