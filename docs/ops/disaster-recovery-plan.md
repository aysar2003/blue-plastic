# SOM ERP — Qorshe Badbaado Buuxda (Disaster Recovery & Data Protection)

**Audience:** system owner / operator  
**Stack:** Next.js app · PostgreSQL · Prisma · Cloudflare R2 · Auth.js  
**Cabbirka ganacsiga:** ~20 named users, 4–5 concurrent  
**La cusbooneysiiyey:** 2026-11-26  

Qorshahan wuxuu isku xiraa:
- awoodaha **hore ugu jira** SOM ERP (backup JSON, restore, import, soft-delete/Trash, year-archive, ledger triggers, R2)
- standard-yada caalamka: **NIST SP 800-53 CP-9/CP-10**, **ISO/IEC 27001:2022 A.8.13**, **ISO 22301**, **SNIA Data Protection 2025**, xeerka **3-2-1-1-0**, PostgreSQL **PITR**

---

## 1. Yoolka (maxaa la gaarayaa)

| Metric | Yoolka SOM ERP (xafiis 20 user) | Macnaha |
| --- | --- | --- |
| **RPO** | **≤ 1 saac** (ideal); ugu badnaan 24 saac | Inta ugu badan ee xog laga lumin karo |
| **RTO** | **≤ 4 saac** | Inta ugu badan ee system-ku xiran karo kahor soo celinta |
| **Copies** | **3-2-1-1-0** | 3 nuqul · 2 nooc kaydin · 1 offsite · 1 immutable/offline · 0 error marka la tijaabiyo |
| **Test** | Quarterly restore + annual full DR | Backup aan la tijaabin = rajo, maaha awood |

**Heerka “ugu qaalisan” (gold):** Neon/Supabase **PITR** + daily snapshots · R2 versioning · toddobaadle company JSON offsite · quarterly restore drill · secrets/runbook meel gooni ah.

---

## 2. Maxay system-yada caalamka sameeyaan?

| Heer | Caalamka (ERP / SaaS accounting) | SOM ERP maanta |
| --- | --- | --- |
| Database continuous backup / PITR | WAL + base backup ama managed PITR | Ku tiirsan host (Neon/Supabase/…) — **waa inaad shiddo** |
| Per-company logical backup | Tenant export (org-scoped) | ✅ `/api/backup` + Databases UI |
| Per-company restore | Replace / import without rolling back other tenants | ✅ `replaceCompanyFromBackup` + `importMissingCompanies` |
| Soft delete / trash | Undo user mistakes without full restore | ✅ Trash + ADR-0013 |
| Immutable ledger | DB-enforced accounting integrity | ✅ Triggers + ADR-0002 + `pnpm db:harden` |
| Fiscal year cold storage | Archive closed years | ✅ Year archive (5 live years, gzip + SHA-256) |
| Object/file backup | Separate from DB | ✅ Cloudflare R2 (`server/files/object-store.ts`) |
| Immutable / offline copy | Ransomware resistance | ⚠️ Operator: Drive/USB/object-lock — **ma automatic** |
| Documented DR test | Quarterly | ⚠️ Qorshahan + checklist — **waa inaad sameyso** |

---

## 3. Sawirka badbaadada (3 lakab)

```
  [A] PRODUCTION
      App (Vercel / host)  →  Postgres (primary)  →  R2 (files)
                │                    │                  │
  [B] AUTOMATIC PROTECTION           │                  │
      (host) daily + PITR  ←─────────┘     R2 versioning / second bucket
                │
  [C] OPERATOR COPIES (3-2-1-1-0)
      1) Live data
      2) Host snapshots / PITR
      3) Weekly JSON backup → Google Drive / OneDrive + USB (immutable/offline)
```

**Muhiim:** RAID ama replica kaliya ma beddelaan backup. Snapshot isla account-ka ransomware la geli karo maaha “1 immutable”.

---

## 4. Waxyaabaha muhiimka ah ee la ilaalinayo

| # | Asset | Meesha | Haddii lumo |
| --- | --- | --- | --- |
| 1 | Ledger + documents + master data | PostgreSQL | Xisaabta oo dhan |
| 2 | Uploads (logos, papers, receipts) | R2 bucket | Faylal ma muuqdaan inagoo DB jira |
| 3 | `AUTH_SECRET`, DB URLs, R2 keys | Env (Vercel + local vault) | Login / deploy wuu jabaa |
| 4 | Company backup JSON | Downloads + offsite | Soo celin shirkad keliya (logical) |
| 5 | Year-archive packages | DB / archive path | Sanadaha duugga |
| 6 | Runbook (qorshahan + passwords meel ammaan) | Offline copy | Recovery wuu gaabiyaa |
| 7 | DNS / custom domain / `APP_URL` | Registrar + Vercel | Dadka ma galaan URL sax |

**Ha ku darin backup JSON:** passwords, sessions, tokens (design sax ah — amniga).

---

## 5. Yoolasha RPO/RTO — sida loo gaaro

| Khatar | RPO target | Habka |
| --- | --- | --- |
| Disk/DB crash | ≤ 1h | Managed Postgres **PITR** / continuous WAL |
| Qalad user (invoice qaldan) | daqiiqado | Trash → Restore (kahor Clear) |
| Shirkad dhan kharribantay | backup-kii ugu dambeeyay | Databases → restore from JSON |
| Ransomware / account compromise | ≤ 24h (offline copy) | JSON + DB snapshot **meel aan la geli karin** |
| Faylal R2 | ≤ 24h | R2 versioning ama second bucket |

| Outage | RTO target | Habka |
| --- | --- | --- |
| App host down | ≤ 1h | Redeploy Vercel / flip DNS |
| DB restore (full) | ≤ 4h | Host restore UI + `pnpm db:deploy` + verify |
| Company logical restore | ≤ 2h | Import/replace + smoke test |

---

## 6. Qorshaha “ugu qaalisan” — setup (hal mar)

Samee sida taxanahan. Calaamadee markaad dhamayso.

### Tallaabo A — Database (lakabka ugu muhiimsan)

1. [ ] Dooro managed Postgres: **Neon** ama **Supabase** (production, maaha free-only haddii xisaabtu ku xiran tahay).
2. [ ] Shid **automatic daily backups**.
3. [ ] Shid **Point-in-Time Recovery (PITR)** / WAL retention **ugu yaraan 7–14 maalmood** (gold: 30 maalmood).
4. [ ] Deji `DATABASE_URL` (pooled) iyo `DIRECT_URL` (direct) ee Vercel + `.env` local.
5. [ ] Socod: `pnpm db:deploy` ka dibna `pnpm db:harden` (triggers R1–R10 + least-privilege).
6. [ ] Runtime role `erp_app` (least privilege) — migrations kaliya superuser/`DIRECT_URL`.
7. [ ] Hubi alerts: email/SMS marka backup fashilmo.

### Tallaabo B — App host

8. [ ] Deploy production (Vercel recommended ee stack-kan).
9. [ ] Env vars: `AUTH_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `APP_URL`, `AUTH_URL`, R2_*.
10. [ ] `AUTH_SECRET` kaydi password manager (1Password/Bitwarden) — **labo qof** ugu yaraan.
11. [ ] Custom domain + HTTPS valid.
12. [ ] Ha u oggolaanin production `http://` ama secrets repo-ga.

### Tallaabo C — Faylasha (R2)

13. [ ] Abuuri Cloudflare R2 bucket gaar ah production.
14. [ ] Shid **object versioning** (ama second bucket `*-dr` mid kale region/account).
15. [ ] Buuxi `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
16. [ ] Tijaabi upload mid yar (logo) ka dibna download.

### Tallaabo D — Logical company backups (SOM ERP)

17. [ ] System owner: **Databases** → Download company (ama `scope=all`).
18. [ ] Kaydi meel 1: Google Drive / OneDrive folder `SOM-ERP-Backups/YYYY/`.
19. [ ] Kaydi meel 2: USB ama disk offline (immutable/air-gap style).
20. [ ] Magaca file: `company-backup-YYYY-MM-DD.json` ama `databases-backup-YYYY-MM-DD.json`.
21. [ ] Ikhtiyaar: `node scripts/save-backups-to-downloads.mjs` (local machine ammaan ah).

### Tallaabo E — Amniga iyo access

22. [ ] Kaliya system owner ayaa restore/import sameyn kara (sida code-ka u yaal).
23. [ ] MFA / password xooggan owner + admins.
24. [ ] Review memberships: dadka aan shaqaynayn `SUSPENDED`.
25. [ ] Ha wadavin production DB credentials laptop kasta.

### Tallaabo F — Runbook offline

26. [ ] Daabac ama PDF ka dhig qorshahan + liiska secrets *meelaha* (ma qiimaha secrets).
27. [ ] Qor: yaa go’aan restore qaata, taleefanka hosting, account IDs.
28. [ ] Kaydi runbook meel **aan ahayn** server-ka production.

---

## 7. Hawlaha joogtada ah (calendar)

| Goorma | Maxaa la sameeyaa | Yaa |
| --- | --- | --- |
| **Maalin kasta** | Host DB backup/PITR waa automatic — hubi dashboard “green” toddobaadkii hal mar | Owner |
| **Toddobaad kasta** (tusaale Jimce close ka dib) | Databases → Download JSON → Drive + USB | System owner |
| **Bil kasta** | Sanad/xisaab close; Trash review; ha Clear-inin wax aadan hubin | Accountant + owner |
| **Sanad kasta** (kadib close) | Periods → Archive closed year (checksum) | Owner |
| **Quarter (3 bilood)** | **Restore drill** (hoos) | Owner + 1 user shaqo |
| **Sanadkii** | Full DR: assume DB lost → restore host + smoke test dhammaystiran | Owner |

### Toddobaadle — checklist 5 daqiiqo

1. Open Databases → Download current company (ama all).
2. File-ka geli `SOM-ERP-Backups/`.
3. Copy USB.
4. Qor taariikhda spreadsheet yar: `date | filename | size | who`.

---

## 8. Tijaabinta soo celinta (waa qasab — ISO/NIST)

**Scenario A — qalad user (fudud)**  
1. Soft-delete document test environment ama company test.  
2. Trash → Restore.  
3. Hubi trial balance / document list.

**Scenario B — company logical restore**  
1. Import backup → company **cusub** (ama staging), **ha replace-inin production** bilow.  
2. Login, Trial Balance, mid sale, mid payment, stock on hand.  
3. Marka la hubiyo, kaliya markaas replace production haddii loo baahdo.

**Scenario C — full DB (quarterly)**  
1. Restore Postgres snapshot/PITR → **instance cusub** (isolated).  
2. Point a staging app at it (ama local `pnpm start`).  
3. `pnpm db:verify` / open app / smoke: login → invoice list → TB.  
4. Qor: wakhtiga dhabta ah (RTC) vs RTO 4h.

**Smoke test gaaban (kasta restore ka dib):**

- [ ] Login owner + 1 staff role  
- [ ] Customers list  
- [ ] Open invoice / bill  
- [ ] Trial balance opens  
- [ ] Stock on hand  
- [ ] Mid file/logo ka R2 wuu muuqdaa  

---

## 9. Marka dhib dhaco — go’aan degdeg ah

| Xaalad | Samee marka hore | Ha sameyn |
| --- | --- | --- |
| Document qaldan | Trash / reverse flow ee app | Clear Trash, wipe DB |
| Shirkad dhan kharribantay | Restore JSON → staging marka hore | Replace production adigoon tijaabin |
| DB oo dhan ma shaqeeyo | Host status + PITR restore | Panic `db:reset` production |
| Ransomware / account la jabiyey | **Jooji access**; soo celi ka **offline/immutable** copy | Ha lacag bixin / ha ku tiirsan snapshot isla account-ka |
| Faylal ma muuqdaan | Hubi R2 keys + versioning | Ha overwrite-inin bucket |

**Kala hormarin:** (1) jooji dhaawac dheeraad (2) xafid caddayn (3) restore staging (4) verify (5) cutover production.

---

## 10. Qiimaha qiyaasta (gold vs ku filan)

| Heer | Bilaha ~ | Waxa ku jira |
| --- | --- | --- |
| **Ku filan (20 user)** | $0–40 | Vercel + Neon/Supabase backups + R2 + weekly JSON |
| **Gold (ugu qaalisan)** | $40–120 | PITR 14–30d + paid DB + R2 versioning + offsite Drive/USB + quarterly paid time for drill |
| **Enterprise later (100+ user)** | $200+ | Replica, multi-region, formal BC plan, on-call |

20 user / 5 online: **ku filan + toddobaadle JSON + quarterly drill** ayaa buuxda haddii PITR shidan yahay. Gold wuxuu ku darayaa retention dheer + immutable offsite + tijaabo qoran.

---

## 11. Mapping — tools gudaha repo

| Baahi | Meesha code / UI |
| --- | --- |
| Download backup | `GET /api/backup` · Databases board |
| Restore replace | `backup-restore.service` · system owner |
| Import companies | `backup-import.service` · `/api/backup/import` |
| Format v1/v2 | `lib/backup-format.ts` |
| Local dump script | `scripts/save-backups-to-downloads.mjs` |
| Soft delete | ADR-0013 · Settings → Trash |
| Year archive | `year-archive.service` · Periods |
| Files | `server/files/object-store.ts` · R2 env |
| Integrity SQL | `pnpm db:harden` · `pnpm db:verify` |
| Scale / live years | `docs/ops/scale.md` · `LIVE_FISCAL_YEARS = 5` |

---

## 12. Definition of Done — “badbaado buuxda”

System-ku waa **badbaado buuxda** marka **dhammaan** kuwan ay run yihiin:

1. Managed Postgres **daily backup + PITR ≥ 7 days** waa shidan.  
2. R2 production configured + versioning ama DR bucket.  
3. Secrets waa password manager, maaha chat/email.  
4. Weekly JSON backup waxaa la hayaa **Drive + USB** ≥ 4 toddobaad.  
5. Restore drill ugu yaraan **hal mar** la sameeyey, natiijada la qoray (RTC ≤ RTO).  
6. Runbook offline ayaa jira.  
7. `db:harden` triggers waa apply-gareysan production.

Haddii mid ka mid ah uu maqan yahay, badbaadadu waa **qayb** — maaha buuxda.

---

## 13. Tixraacyo (cilmi / standard)

- NIST SP 800-53 Rev. 5 — CP-9 System Backup, CP-10 System Recovery  
- ISO/IEC 27001:2022 — A.8.13 Information backup  
- ISO 22301 — business continuity / RTO alignment  
- SNIA Data Protection Best Practice (2025) — RPO/RTO/RTC, 3-2-1  
- Microsoft / industry — **3-2-1-1-0** (immutable + verified zero-error)  
- PostgreSQL docs — Continuous Archiving & PITR  
- AWS / SaaS multi-tenant guidance — cluster PITR + **per-tenant logical** restore (SOM ERP company backup wuxuu buuxiyaa qaybtan)

---

## 14. Next actions (adiga — toddobaadkan)

1. Shid PITR / automatic backups Postgres host.  
2. Hubi R2 env production.  
3. Samee Download JSON ugu horreysa → Drive + USB.  
4. Qor taariikhda backup spreadsheet.  
5. Schedule calendar reminder: **Jimce 16:00 — SOM ERP backup**.  
6. 90 maalmood gudahood: Scenario B restore drill (company cusub).

Markaad dhammaystirto qaybta 12, ku qor halkan:

> **Last DR drill:** YYYY-MM-DD · **RTC:** _h_ · **Passed:** yes/no · **Owner:** _

---

## 15. Execution log (automatic / operator)

| Taariikh | Waxa la sameeyey | Natiijo |
| --- | --- | --- |
| 2026-11-26 | Env health: Supabase EU + R2 `blue-plastic` configured | OK |
| 2026-11-26 | First full JSON backup → `Downloads/` (9 companies + bundle ~187 MB) | OK |
| 2026-11-26 | Owner kaydiyey Drive + USB (3-2-1 offsite + offline) | OK |
| 2026-11-26 | Windows Task Scheduler `SOM-ERP-Weekly-Backup` (Jimce 16:00 → `scripts/weekly-backup.cmd`) | OK |
| 2026-11-26 | PITR (Supabase add-on ~$100/bil) | **Skipped by owner** — lacag; rely on plan backups + weekly JSON |
| 2026-11-26 | Archive + test: `backups/2026-11-26/` · list 187MB bundle (9 cos) · import smoke materials | OK |
| | Quarterly restore drill (replace live) | Pending — use staging / `--yes` only when needed |
