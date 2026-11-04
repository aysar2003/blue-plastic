# SOM ERP user manuals

Source of truth: `content/user-manual/chapters/*.en.md` and `*.so.md` (table of contents in `content/user-manual/index.ts`).

In the app: **Help → User manual** (`/help/manual`), plus short guides `/help/guide` (EN) and `/help/guide-so` (SO).

## Rebuild printable books

```bash
pnpm exec tsx scripts/assemble-user-manual.ts
```

Writes:

- `SOM-ERP-User-Manual.en.md`
- `SOM-ERP-User-Manual.so.md`

## Maintainer notes

See `walkthrough-findings.md` for UI obstacles captured during human walkthroughs.
