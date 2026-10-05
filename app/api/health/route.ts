import { databaseProblem, databaseProblemText } from '@/lib/db-error'
import { db } from '@/server/db'

export const dynamic = 'force-dynamic'

/**
 * Runtime check that does not require a session. The body names the kind of
 * database failure and never the connection string.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return Response.json({ ok: true, database: 'up' })
  } catch (error) {
    const problem = databaseProblem(error) ?? 'unknown'
    return Response.json(
      { ok: false, database: 'down', problem, message: databaseProblemText(problem) },
      { status: 503 },
    )
  }
}
