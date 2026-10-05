import { databaseProblem, databaseProblemText, type DatabaseProblem } from '@/lib/db-error'

/**
 * Shown instead of a blank server error when Postgres cannot be used.
 * The connection string is never included.
 */
export function DatabaseUnavailable({ error }: { error?: unknown }) {
  const problem: DatabaseProblem = (error ? databaseProblem(error) : null) ?? 'unknown'

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Blue Plastic Center</p>
      <h1 className="text-2xl font-semibold tracking-tight">The books cannot reach the database</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{databaseProblemText(problem)}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">DATABASE_URL</span> — pooled Postgres URL, used at runtime.
        </li>
        <li>
          <span className="font-medium text-foreground">DIRECT_URL</span> — direct URL for <span className="font-mono">pnpm db:deploy</span>.
        </li>
        <li>
          <span className="font-medium text-foreground">AUTH_SECRET</span> — at least 32 characters.
        </li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Auth.js already trusts the request host, so <span className="font-mono">AUTH_URL</span> is optional. Set it
        only if sign-in must use one canonical address.
      </p>
    </main>
  )
}
