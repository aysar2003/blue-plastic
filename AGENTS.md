<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cloud Agent environment

PostgreSQL 16 is installed in the image. On boot, the environment start script starts the cluster with `pg_ctlcluster` (systemd is not available), creates the `blue_plastic` database, writes a gitignored `.env` (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`), applies migrations, hardens ledger triggers, and runs `next dev --hostname 127.0.0.1 --port 3000`. Open http://127.0.0.1:3000. Next.js blocks dev JavaScript when the browser host does not match that hostname. `GET /api/health` reports the database. An empty database opens `/setup`. The verified image already has an organisation: sign in as `owner@blueplastic.test` / `books-dev-1`.

`pnpm verify` and `pnpm db:deploy` use PowerShell (`$LASTEXITCODE`) and fail in this Linux shell. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` separately. Apply migrations with `pnpm exec prisma migrate deploy`, then `pnpm db:harden`.
