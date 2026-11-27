# UAT results — 2026-11-26

Operator-run go-live tests for SOM ERP (process: [go-live-process.md](./go-live-process.md)).

## Summary

| Area | Result | Notes |
| --- | --- | --- |
| Vitest erp-readiness + cycle docs | **PASS** | 19 tests |
| Playwright cycle path docs | **PASS** | |
| Playwright staff login door | **PASS** | `http://127.0.0.1:3000/login/staff` |
| Playwright authenticated walk | **SKIP** | `E2E_EMAIL` / `E2E_PASSWORD` unset |
| Browser login page | **PASS** | Staff login UI loads |
| DB UAT: buy → stock → sell → TB | **PASS** | Rolled back — no production write kept |
| Backup archive | **PASS** | Earlier: `backups/2026-11-26/` + Drive/USB |

**Overall Day-1 core cycle (ledger):** **PASS**  
**Full browser clerk walk:** blocked until E2E credentials are set.

---

## 1) Automated readiness

```
pnpm exec vitest run tests/erp-readiness.test.ts tests/e2e-accounting-cycle.test.ts tests/wave-f-deepen.test.ts
→ 3 files, 19 passed
```

## 2) Playwright cycle smoke

```
pnpm exec playwright test e2e/cycle-smoke.spec.ts
→ documents path: PASS
→ staff login door: PASS
→ authenticated walk: SKIPPED (no E2E_EMAIL/PASSWORD)
```

## 3) DB operating-cycle UAT (rolled back)

```
ALLOW_DB_TESTS=1 pnpm exec vitest run tests/uat-operating-cycle.test.ts
```

Log:

```
[uat] master-data: customer + vendor + inventory item
[uat] buy: bill posted (AP)
[uat] stock: received 10 @ 10
[uat] sell: invoice posted (AR + COGS)
[uat] stock: on hand 8 after sale
[uat] tb: balanced 110.00 = 110.00
[uat] periods: fiscal period present
```

→ **PASS** (transaction aborted; live companies untouched)

## 4) Live company snapshot (read-only)

| Company | Customers | Items | Accounts | Journals | Invoices | Bills |
| --- | --- | --- | --- | --- | --- | --- |
| AL FURAAT GROUP | 965 | 1892 | 200 | 25714 | 5261 | 1494 |
| AL FURAAT MATERIALS | 12 | 639 | 46 | 677 | 275 | 402 |
| BLUE PLASTIC CENTER | 0 | 0 | 46 | 0 | 0 | 0 |
| MUMTAAZ COSMATICS | 0 | 0 | 46 | 0 | 0 | 0 |

**Readiness tip:** Blue Plastic / Mumtaaz have chart but **no master data** — Day 1 needs customers/items before trading. Al Furaat companies already have operating history.

---

## Gaps before “full go-live sign-off”

1. [ ] Set `E2E_EMAIL` + `E2E_PASSWORD` → re-run authenticated Playwright walk  
2. [ ] Pick Day 1 company + fill §2.2 scope in go-live-process  
3. [ ] For Blue Plastic: load customers/items (or choose Al Furaat Materials)  
4. [ ] Month-end close once on chosen company (human)  
5. [ ] Payment → deposit → bank reconcile (browser or extend UAT) — not in this DB UAT yet  

---

## Re-run commands

```powershell
pnpm exec vitest run tests/erp-readiness.test.ts tests/e2e-accounting-cycle.test.ts tests/wave-f-deepen.test.ts
pnpm exec playwright test e2e/cycle-smoke.spec.ts
$env:ALLOW_DB_TESTS="1"; pnpm exec vitest run tests/uat-operating-cycle.test.ts
```
