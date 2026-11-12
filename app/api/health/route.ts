import { databaseProblem, databaseProblemText } from '@/lib/db-error'
import { db } from '@/server/db'

export const dynamic = 'force-dynamic'

function authorizedDetail(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  const bearer = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim()
  const alt = request.headers.get('x-cron-secret')?.trim()
  return bearer === secret || alt === secret
}

/**
 * Liveness probe. Public body stays generic so attackers learn nothing about
 * the database. Detailed status requires CRON_SECRET (same as other ops routes).
 */
export async function GET(request: Request) {
  const detail = authorizedDetail(request)
  try {
    await db.$queryRaw`SELECT 1`
    if (detail) return Response.json({ ok: true, database: 'up' })
    return Response.json({ ok: true })
  } catch (error) {
    if (detail) {
      const problem = databaseProblem(error) ?? 'unknown'
      return Response.json(
        { ok: false, database: 'down', problem, message: databaseProblemText(problem) },
        { status: 503 },
      )
    }
    return Response.json({ ok: false }, { status: 503 })
  }
}
