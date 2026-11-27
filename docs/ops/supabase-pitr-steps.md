# Supabase — shid backup / PITR (SOM ERP)

DB-gaagu wuxuu ku yaal **Supabase** (`eu-west-1`). Tani waa tallaabooyinka dashboard-ka.

> **Go’aan 2026-11-26:** Owner wuxuu **iska dhaafay PITR** qiimaha dartii (~$100/bil).  
> Badbaadada hadda: Supabase plan daily backups (haddii Pro+) + weekly JSON → Drive + USB + Task Scheduler Jimce.

## A) Hubi daily backups (ugu yar)

1. Gel [Supabase Dashboard](https://supabase.com/dashboard)
2. Dooro project-ka SOM ERP
3. Tag **Database → Backups**
4. Hubi in daily backups ay jiraan

| Plan | Daily backups |
| --- | --- |
| Free | Ma jiraan (download dump adigu) — **ha ku tiirsan production accounting** |
| Pro | 7 maalmood |
| Team | 14 maalmood |
| Enterprise | ilaa 30 |

Haddii aad ku jirto **Free**: u kici **Pro**, ama toddobaad kasta samee JSON backup (waan horay u sameynay).

## B) PITR — yoolka gold (RPO ~2 daqiiqo)

Qiimo qiyaas: **~$100/bil** (7 maalmood retention), ka badan haddii 14/28.

1. Project → **Settings → Add-ons**
2. **Point in Time Recovery** → enable
3. Dooro retention: **7** (ugu yar gold) ama **14**
4. Confirm
5. Tag **Database → Backups** → tab **Point in time** — waa inuu muuqdo

**Ogeysiis:** marka PITR shidmo, Supabase ma sii qaado daily backups caadiga ah (PITR ayaa ka fiican).

## C) Restore (marka loo baahdo)

1. **Ha restore-inin production marka hore** haddii aad xogta hadda haysatid — abuuri / restore project cusub ama staging
2. Database → Backups → Start a restore
3. Dooro waqtiga **kahor** dhibaatada
4. Ka dib staging: `pnpm start` + smoke test (login, TB, invoice, stock)

## D) DIRECT_URL (muhiim migrations)

Runtime `DATABASE_URL` waa inuu ahaadaa **pooler**.  
Migrations / `db:harden` waa inay isticmaalaan **direct** host (port **5432**, maaha pooler 6543).

Supabase: Project Settings → Database → connection string **Direct** (maaha Transaction pooler).

Haddii `DIRECT_URL` uu sidoo kale pooler yahay, `pnpm db:deploy` / harden waxay dhibaato geli karaan.
