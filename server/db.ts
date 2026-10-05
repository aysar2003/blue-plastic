import 'server-only'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { env } from '@/lib/env'

/**
 * The tables where "deleted" is a flag rather than a missing row.
 *
 * Deleting a transaction in this system marks it and leaves it in the database —
 * the reasoning is in `server/accounting/deletion.ts`. The consequence is that
 * every read has to exclude the marked ones, and there are something like seventy
 * of those across the services and the reports.
 *
 * Seventy places to remember is seventy places to forget, and the one that gets
 * forgotten shows a deleted invoice on a report. So the filter is applied here,
 * once, by a client extension: a query against these models excludes deleted rows
 * unless it says otherwise. The code that has to see them — the delete path
 * itself, and the audit trail — asks for them explicitly with
 * `deletedAt: { not: undefined }` or by going through `withDeleted`.
 */
const SOFT_DELETED_MODELS = new Set([
  'SalesDocument',
  'PurchaseDocument',
  'CustomerPayment',
  'BillPayment',
  'BankTransfer',
  'Deposit',
  'InventoryAdjustment',
  'Item',
])

const READS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy',
])

type QueryArgs = { where?: Record<string, unknown> } & Record<string, unknown>

/**
 * `true` when the caller has already said something about `deletedAt` — including
 * `undefined`, which is how a caller says "I want both".
 */
const mentionsDeletion = (where: Record<string, unknown> | undefined) =>
  where !== undefined && 'deletedAt' in where

function withoutDeleted(args: QueryArgs): QueryArgs {
  if (mentionsDeletion(args.where)) {
    // `deletedAt: undefined` means "show me everything"; Prisma would ignore the
    // key, so it is removed rather than passed through.
    const { deletedAt, ...rest } = args.where as { deletedAt?: unknown }
    return deletedAt === undefined ? { ...args, where: rest } : args
  }
  return { ...args, where: { ...(args.where ?? {}), deletedAt: null } }
}

/**
 * Prisma 7 takes its connection through a driver adapter rather than a URL in the
 * schema. `@prisma/adapter-pg` wraps node-postgres, which also gives us a real
 * connection pool we can size.
 */
function createClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // One connection per serverless instance. Pair with DATABASE_URL
    // pgbouncer=true and connection_limit=1 on the Supabase transaction pooler (:6543).
    max: env.NODE_ENV === 'production' ? 1 : 5,
    // Fail the page quickly when the pooler is paused or the host is wrong,
    // instead of hanging until the platform kills the function.
    connectionTimeoutMillis: 8_000,
  })

  const client = new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    // Prisma's 5s default assumes a database on the same machine. Ours is remote,
    // and the transactions that matter here are multi-statement by nature — a
    // document and its journal must commit together or not at all. First-run setup
    // alone writes an organisation, a user, a membership and fifteen sequences.
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
  })

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!SOFT_DELETED_MODELS.has(model) || !READS.has(operation)) {
            return query(args)
          }
          return query(withoutDeleted(args as QueryArgs))
        },
      },
    },
  }) as unknown as PrismaClient
}

/**
 * One client per process, created on first query rather than on import.
 *
 * Deferring construction matters twice over: `next build` evaluates every page
 * module while collecting page data and must not need a database URL to do it,
 * and a serverless cold start should not pay for a connection pool the request
 * may never use.
 *
 * The dev-mode global is what stops Next.js's module re-evaluation from opening a
 * new pool on every file save until Postgres refuses the connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const getClient = (): PrismaClient => (globalForPrisma.prisma ??= createClient())

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient()
    const value = Reflect.get(client, property, client)
    // Model delegates (`db.user`) are objects; top-level methods (`db.$transaction`)
    // are functions and lose their receiver unless bound.
    return typeof value === 'function' ? value.bind(client) : value
  },
})

/** The client type inside `db.$transaction(async (tx) => …)`. */
export type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>
