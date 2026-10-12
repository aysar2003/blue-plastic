# SOM ERP — Accounting System Documentation

A double-entry accounting platform (QuickBooks Online–class, excluding Payroll and
Projects) built with Next.js, TypeScript, PostgreSQL, Prisma, NextAuth v5, Zod,
Tailwind CSS, shadcn/ui and TanStack Query. Product brand: **SOM ERP**.

## Read in this order

| Doc | What it covers |
| --- | --- |
| [00-analysis.md](./00-analysis.md) | Starting-point analysis of the repository |
| [01-architecture.md](./01-architecture.md) | Target application architecture, layering, data-flow rules |
| [02-accounting-design.md](./02-accounting-design.md) | The accounting engine: journals, posting, integrity rules, document→journal map |
| [03-database-design.md](./03-database-design.md) | Full data model across all phases |
| [04-roadmap.md](./04-roadmap.md) | Phases, dependencies, exit criteria |
| [05-conventions.md](./05-conventions.md) | Code conventions, error handling, testing, naming |
| [progress.md](./progress.md) | Live status board — updated at the end of every phase |
| [decisions/](./decisions/) | Architecture Decision Records (ADRs) |
| [phases/](./phases/) | Task breakdown per phase |

## Hard rules for anyone (human or AI) working in this repo

1. **Nothing writes to the general ledger except the posting engine**
   (`src/server/accounting/posting.ts`). No service, no route, no script.
2. **Posted journals are immutable.** Corrections are reversals, never edits.
   Database triggers enforce this — application code is the second line of defence.
3. **Every query is organisation-scoped.** `orgId` comes from the session, never
   from the request body.
4. **Money is `NUMERIC(19,4)`.** Never a JavaScript `number`. Never a float.
5. One phase at a time. Do not start the next phase without explicit instruction.
