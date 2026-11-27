# SOM ERP — Process: system la isticmaali karo (Go-Live / Operating Ready)

**Ujeeddo:** in SOM ERP noqdo mid **dhamaystiran oo shaqada gudan kara** — maaha kaliya code dhammaystiran, ee waa ganacsi ku shaqaynaya.

**Sal: methodology caalamka** (Envision → Build → Test → Deploy → Adopt) + Microsoft / Dynamics go-live checklist + master-data / UAT / cutover / hypercare.  
**Map:** awoodaha SOM ERP ee jira (`/onboarding`, Setup, packs, cycle smoke, backup, manuals).

**Cabbirkaaga:** ~20 user, 4–5 concurrent · shirkado dhowr (Al Furaat, Blue Plastic, …).

---

## 0. Xaqiiqda hadda (baritaan)

| Heer | Xaalad |
| --- | --- |
| Software (phases 1–60 + waves) | ✅ Feature-complete ee scope-ka documented |
| Ledger integrity (triggers, soft-delete, harden) | ✅ Jira |
| Onboarding / packs / Setup heal | ✅ `/onboarding`, Settings → Setup, industry packs |
| Backup / DR | ✅ JSON + Drive/USB + weekly task; PITR la iska dhaafay |
| **Isticmaal dhabta ah (process + dad + xog nadiif)** | ⚠️ Tan ayaa process-kani buuxinayaa |

**Truth:** ERP “dhamaystiran” software ahaan ≠ “shaqada gudanaya”. Caalamka waxay u baahan yihiin: **xog sax · process la aqbalay · tababar · cutover · hypercare**.

---

## 1. Sawirka process-ka (5 marxaladood)

```
  1. GO’AAN & BAADHITAAN     → maxaa shaqada u geli doona (scope)
  2. DIYAARINTA XOGTA        → chart, customers, items, balances
  3. UAT / CYCLE TIJAABO     → sell→pay→buy→stock→recon→close
  4. CUTOVER / GO-LIVE       → freeze, opening balances, users live
  5. HYPERCARE & CLOSE        → toddobaadyo taageero + period close
```

Ha isku darin dhammaan modules maalin kasta. **Core trading loop** marka hore; verticals (school, hospital, …) marka loop-kaasi xasilo.

---

## 2. Marxalad 1 — Go’aan & baadhitaan (3–7 maalmood)

### 2.1 Dooro “company of record”
- Hal shirkad ugu horreysa oo **live** noqonaysa (tusaale BLUE PLASTIC ama AL FURAAT MATERIALS).
- Kuwa kale: kaydi / training / later.

### 2.2 Scope checklist (saxiix owner)

| Process | Live Day 1? | Owner ganacsi |
| --- | --- | --- |
| Iib (invoice → payment → deposit) | ☐ Haa / ☐ Maya | |
| Iibsi (bill → pay bill) | ☐ | |
| Kayd (receive / adjust / on hand) | ☐ | |
| Banking reconcile | ☐ | |
| Period close bil kasta | ☐ | |
| POS | ☐ | |
| Payroll / HR | ☐ | |
| Vertical pack (school, …) | ☐ | |

**Xeer:** waxaan Day 1 gelinayn waa in la UAT-gareeyo. Wax kale = Phase 2 ka dib hypercare.

### 2.3 Roles
| Door | Magac | Shaqo |
| --- | --- | --- |
| Sponsor / System owner | | Go’aan go-live / rollback |
| Super user (xisaabiye) | | Chart, close, tax |
| Super user (operations) | | iib/iibsi/kayd |
| IT / deploy | | Vercel, Supabase, backup |

### 2.4 Exit
- [ ] Scope sheet la saxiixay  
- [ ] Go-live taariikh la dooray (tusaale bil bilow)  
- [ ] Legacy (Excel/QB) access plan: akhris kaliya muddo X

---

## 3. Marxalad 2 — Diyaarinta xogta (1–2 toddobaad)

Kala hormariska **User Manual §2** + Setup:

### 3.1 Foundation (hal mar shirkad)
1. [ ] `/onboarding` ama Settings → Setup — pack sax ah  
2. [ ] Settings → Organisation (currency, FY start, logo)  
3. [ ] Chart of accounts — nadiifi / magac-beddel  
4. [ ] Settings → Default accounts  
5. [ ] Settings → Tax (haddii loo baahdo) **kahor** documents canshuur leh  
6. [ ] Settings → Apps — kaliya modules Day 1  
7. [ ] Settings → Company users — roles dhabta ah (maaha dhammaan OWNER)

### 3.2 Master data
1. [ ] Customers (+ opening AR haddii loo baahdo)  
2. [ ] Vendors  
3. [ ] Products & services (income/COGS/inventory accounts sax)  
4. [ ] Stores / bins haddii inventory live yahay  
5. [ ] Bank accounts + opening cash  

### 3.3 Setup Fix Hub
1. [ ] Settings → Setup / heal — SKU, reorder, country gaps  
2. [ ] Download heal report haddii gaps badan yihiin  
3. [ ] Repeat ilaa gaps muhiim ahi eber yihiin  

### 3.4 Opening / migration
| Nooca | Hab SOM ERP |
| --- | --- |
| Balances maalin go-live | Opening journals / opening balance equity |
| History dheer | Optional; badanaa **ha soo rarinin** — legacy akhris |
| QB / file hore | Trial migrate → reconcile → kaliya markaas cutover |

### 3.5 Exit
- [ ] Master data owner saxiixay “counts + sample spot-check”  
- [ ] Trial balance opening makhraj ma aha (0 ama la sharxay)  
- [ ] Backup JSON + Drive/USB **kahor** cutover (`pnpm backup:json`)

---

## 4. Marxalad 3 — UAT / cycle tijaabo (5–10 maalmood)

### 4.1 Script caalamka ee SOM ERP (happy path)

Samee **company test** ama company yar — ha ku dhaqaaqin live ugu horreyn.

| # | Scenario | Screen / natiijo |
| --- | --- | --- |
| 1 | Create customer + item | Master data |
| 2 | Invoice → Post | AR + income |
| 3 | Receive payment → Deposit | Cash / bank |
| 4 | Bill → Post → Pay bill | AP |
| 5 | Receive stock / adjust | Inventory on hand |
| 6 | Bank reconcile (statement yar) | Banking |
| 7 | Trial balance / P&L / BS | Reports |
| 8 | Soft-delete + Trash restore | Trash |
| 9 | Period close checklist (test period) | Periods |

**Automated smoke (haddii credentials):** `pnpm test:e2e:cycle` (sell→pay→buy→stock→recon→close).

### 4.2 Role tests
- [ ] Sales clerk: invoice only — ma delete journal  
- [ ] Accountant: reports + close  
- [ ] Owner: Databases / backup  

### 4.3 Defect rule
| Severity | Go-live |
| --- | --- |
| Blocker (ledger qaldan, ma post-gareyn karo) | **No-go** |
| Major (workaround jira) | Log + owner decide |
| Minor | Hypercare backlog |

### 4.4 Exit
- [ ] Script 1–9 passed oo la qoray (taariikh + qof)  
- [ ] Business sign-off: “waa ku filan Day 1 scope”

---

## 5. Marxalad 4 — Cutover / Go-Live (1–2 maalmood)

### 5.1 T−7
- [ ] Ogeysiis users: taariikh, URL, credentials  
- [ ] Hubi production: Vercel + Supabase + R2 + `AUTH_SECRET`  
- [ ] Hubi weekly backup task `SOM-ERP-Weekly-Backup`  
- [ ] Print / PDF: `docs/ops/disaster-recovery-plan.md` runbook  

### 5.2 T−1 (freeze)
- [ ] Jooji Excel/QB entries cusub (ama marka ugu dambeeya la qoro)  
- [ ] `pnpm backup:json` → Drive + USB  
- [ ] Final opening balances / open AR-AP reconcile vs legacy  

### 5.3 Go-Live day
1. [ ] Users gelayaan production URL  
2. [ ] Super user: create 1 invoice test + 1 bill test → delete/trash nadiif  
3. [ ] Announce: “SOM ERP waa source of truth”  
4. [ ] Legacy = read-only  

### 5.4 Go / No-Go
**GO** haddii: UAT signed · backup fresh · defaults sax · ugu yaraan 1 super user available.  
**NO-GO** haddii: ledger ma post-gareynayo · TB opening qaldan · backup ma jiro.

### 5.5 Rollback (haddii loo baahdo 24–72h)
1. Jooji users  
2. Supabase restore **ama** `pnpm backup:from-file -- restore … --yes` (shirkad)  
3. Ku noqo legacy si ku-meel-gaar ah  
4. Post-mortem

---

## 6. Marxalad 5 — Hypercare & close (2–4 toddobaad)

### 6.1 Toddobaadkii 1
- [ ] Channel taageero (WhatsApp/group) — super users kaliya jawaabaan  
- [ ] Maalin kasta: TB quick look · errors log  
- [ ] Jimce: `pnpm backup:json` + Drive/USB  

### 6.2 Bil kasta (operating rhythm)
| Maalin | Hawl |
| --- | --- |
| Maalin kasta | Post documents sax · ha kaydin drafts bilaa sabab |
| Toddobaad | Bank reconcile · AR/AP aging glance |
| Bil dhamaad | Period close checklist · reports pack · backup |
| Sanad | Year close · archive (`docs/ops/scale.md`) |

### 6.3 Exit hypercare
- [ ] 2 toddobaad la’aan blocker  
- [ ] Users login joogto ah  
- [ ] First month-end close completed  
- [ ] Lessons learned → update manuals / training  

---

## 7. Definition of Done — “shaqada gudan kara”

System-ku waa **operating ready** marka **dhammaan** run yihiin:

1. Scope Day 1 la saxiixay oo UAT passed.  
2. Master data + defaults + tax la aqbalay.  
3. Cycle iib→lacag→iibsi→kayd→recon→report waa la sameeyey xog dhab ah (ama test signed).  
4. Users roles sax · tababar ugu yar role-based.  
5. Production host + R2 + backup toddobaadle + Drive/USB.  
6. Go-live date dhaaftay · legacy read-only.  
7. Ugu yaraan **hal** period close dhabta ah waa la dhammeeyey.

Haddii mid ka mid ah maqan yahay → waa pilot, maaha ERP shaqaynaya.

---

## 8. Qorshe waqti (tusaale 20 user)

| Toddobaad | Focus |
| --- | --- |
| W1 | Scope + roles + Setup foundation |
| W2 | Master data + heal + opening |
| W3 | UAT cycle + training super users |
| W4 | Cutover + hypercare bilow |
| W5–W6 | Stabilize + first month close |

Verticals / POS / payroll: **W7+** marka core xasilo.

---

## 9. Tools gudaha repo (ha dib u ikhtiraacin)

| Baahi | Meesha |
| --- | --- |
| Industry / apps | `/onboarding`, `/register`, Settings → Apps |
| Setup gaps | Settings → Setup, heal APIs |
| End-to-end proof | `pnpm test:e2e:cycle` |
| User how-to | `docs/user-manual/SOM-ERP-User-Manual.so.md` |
| Backup | `pnpm backup:json`, `docs/ops/disaster-recovery-plan.md` |
| Large restore | `pnpm backup:from-file`, `docs/ops/large-backup-import.md` |
| Scale / archive years | `docs/ops/scale.md` |

---

## 10. Checklist degdeg ah (print)

**Kahor go-live**
- [ ] Scope Day 1  
- [ ] COA + defaults + tax  
- [ ] Customers / vendors / items  
- [ ] Users + roles  
- [ ] UAT script passed  
- [ ] Backup Drive+USB  
- [ ] Super users ready  

**Go-live**
- [ ] Freeze legacy writes  
- [ ] Opening OK  
- [ ] Users live  
- [ ] Smoke invoice+bill  

**Ka dib**
- [ ] Hypercare channel  
- [ ] Weekly backup  
- [ ] Month-end close  

---

## 11. UAT execution log

| Taariikh | Waxa | Natiijo |
| --- | --- | --- |
| 2026-11-26 | Agent ran readiness + Playwright login + DB cycle UAT | **PASS** core — see [uat-results-2026-11-26.md](./uat-results-2026-11-26.md) |
| | Authenticated browser walk | SKIP — needs `E2E_EMAIL` / `E2E_PASSWORD` |

## 12. Next action (adiga)

1. Dooro **hal company** Day 1 (Al Furaat Materials = data leh; Blue Plastic = setup cusub).  
2. Buuxi §2.2 scope table.  
3. Optional: geli `.env` → `E2E_EMAIL` + `E2E_PASSWORD` si authenticated walk loo dhammaystiro.  
4. Go-live taariikh + month-end close ugu horreysa.
