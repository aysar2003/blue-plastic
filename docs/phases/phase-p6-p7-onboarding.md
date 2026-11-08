# P6 Coverage gate + P7 Onboarding wizard

**Status:** Complete · 2026-11-08  
**Migration:** `20261108120000_phase_p6_p7_onboarding`

## P6 — Coverage gate

- All 16 industry packs `verticalStatus: ready` (pharmacy, hospitality, education, hospital, P5 verticals, …).
- `/help/coverage` reflects the gate (wizard available).
- `ERP_READY_LOOPS` includes an `institutions` loop.
- Tests: `tests/packs/registry.test.ts` asserts `verticalPlanned === 0`.

## P7 — Wizard + Settings

- `/onboarding` multi-step: institution → coverage → apps → install pack (or skip).
- `Organization.onboardingCompletedAt` + `onboardingChecklistDone`.
- Existing companies back-filled as completed (no forced wizard).
- New Databases companies mark onboarding complete; signup companies leave it open.
- `OnboardingGate` redirects OWNER/ADMIN until complete/skip.
- Settings → Setup checklist + re-run wizard; hub entry under Company.
- OWNER/ADMIN may replace grants when installing a pack for their own org.

## Verify

```bash
pnpm exec prisma migrate deploy
pnpm exec vitest run tests/packs tests/onboarding tests/verticals tests/pharmacy tests/education tests/hospital-billing tests/hospitality tests/erp-readiness.test.ts
pnpm exec tsc --noEmit
```
