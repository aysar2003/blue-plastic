# Import backup weyn (45 MB → 500 MB+)

Browser Import/Restore wuxuu ku xiran yahay upload HTTP — wuxuu fashilmaa marka file-ku ka weyn yahay ~45 MB.  
**Xalka:** akhri file-ka disk-ka computer-kaaga (`pnpm backup:from-file`).

## Marka file-ku yahay ~500 MB

1. Computer-ku haysto **RAM ≥ 8–16 GB**
2. PowerShell:

```powershell
cd C:\Users\Zmart\Desktop\blue-plastic
$env:NODE_OPTIONS="--max-old-space-size=8192"
pnpm backup:from-file -- list --file "$env:USERPROFILE\Downloads\databases-backup-2026-11-26.json"
```

## List shirkadaha gudaha file

```powershell
pnpm backup:from-file -- list --file "C:\Users\Zmart\Downloads\databases-backup-YYYY-MM-DD.json"
```

## Import (shirkad maqan — company cusub)

```powershell
pnpm backup:from-file -- import --file "C:\Users\Zmart\Downloads\blue-plastic-center-backup-….json"
```

Bundle weyn + magac:

```powershell
pnpm backup:from-file -- import --file "…\databases-backup-….json" --name "BLUE PLASTIC CENTER"
```

Dhammaan maqan:

```powershell
pnpm backup:from-file -- import --file "…\databases-backup-….json" --all-missing
```

## Restore (beddel shirkad hore u jirta)

**Khatar:** wuxuu nadiifiyaa buugaagta hadda ee shirkaddaas.

```powershell
pnpm backup:from-file -- restore --file "C:\Users\Zmart\Downloads\al-furaat-materials-backup-….json" --confirm-name "AL FURAAT MATERIALS" --yes
```

## Xusuus

| Hab | Max ~ | Goorta |
| --- | --- | --- |
| UI Import/Restore | ~45 MB | Faylal yar yar |
| `pnpm backup:from-file` | 500 MB+ | Disk + NODE_OPTIONS |
| Supabase daily backup | cluster | Disaster full DB |

Faylasha R2 (logos) maaha gudaha JSON — hubi R2 keys ka dib restore haddii uploads loo baahdo.
