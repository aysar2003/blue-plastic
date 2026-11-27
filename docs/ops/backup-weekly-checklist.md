# SOM ERP — Checklist backup toddobaadle

Isticmaal qorshaha buuxda: [disaster-recovery-plan.md](./disaster-recovery-plan.md)

## Automatic (Windows)

Task Scheduler magaciisa: **`SOM-ERP-Weekly-Backup`**
- Goorta: **Jimce 16:00**
- Waxay oroddaa: `scripts/weekly-backup.cmd` → JSON `Downloads/`
- Kadib weli: copy **Drive + USB** (task-ku ma kaydiyo cloud)

Hubi: Task Scheduler → Task Scheduler Library → `SOM-ERP-Weekly-Backup`

## Jimce kasta (ama close ka dib) — ~5 daqiiqo

1. [ ] Gel SOM ERP sida **system owner**
2. [ ] Tag **Databases**
3. [ ] **Download** company-ga hadda (ama all companies haddii aad tahay system owner)
4. [ ] Kaydi file-ka halkan:
   - Computer: `Downloads/`
   - Cloud: Google Drive / OneDrive → folder `SOM-ERP-Backups/YYYY/`
5. [ ] Copy USB / disk offline
6. [ ] Buuxi log-ga hoose

### Ama local script (machine ammaan ah)

```bash
pnpm backup:json
```

Waxay qortaa JSON-ka `Downloads/` folder-kaaga.  
Folder kale: `BACKUP_DIR=C:\path pnpm backup:json`

Hubi env (sir ma daabaco): `pnpm backup:env-check`

### Bundle vs shirkad keliya

| File | Ujeeddo |
| --- | --- |
| `databases-backup-YYYY-MM-DD.json` | Kaydin **dhammaan systemka** (Drive + USB). **Ha gelin** Import UI. |
| `al-furaat-…-backup-….json` (iwm) | **Import / Restore** gudaha app-ka — mid mid |

Haddii shirkad / bundle ay ka weyn tahay ~45 MB (ilaa 500 MB+):  
**`pnpm backup:from-file`** — hagid: [large-backup-import.md](./large-backup-import.md)

---

## Log

| Taariikh | File magaciisa | Size | Meesha la kaydiyey | Qofka |
| --- | --- | --- | --- | --- |
| | | | Drive + USB | |
| | | | | |
| | | | | |
| | | | | |

## Bil kasta

1. [ ] Hubi Neon/Supabase dashboard: backups / PITR = OK
2. [ ] Hubi R2 bucket weli shaqeynayo (upload mid yar)
3. [ ] Trash: clear kaliya wax aad hubisay

## Quarter (90 maalmood)

1. [ ] Import backup → company **cusub** (staging), ha replace-inin production bilow
2. [ ] Smoke: login · customers · invoice · trial balance · stock · logo/file
3. [ ] Qor natiijada: taariikh · saacadaha · passed yes/no
