/**
 * Classify a failure to reach Postgres without echoing the connection string.
 * The message is safe to show on a status page.
 */
export type DatabaseProblem =
  | 'missing-config'
  | 'unreachable'
  | 'authentication'
  | 'missing-schema'
  | 'timeout'
  | 'ssl'
  | 'unknown'

const CODE_PROBLEM: Record<string, DatabaseProblem> = {
  P1000: 'authentication',
  P1001: 'unreachable',
  P1002: 'timeout',
  P1003: 'missing-schema',
  P1010: 'authentication',
  P1011: 'ssl',
  P1017: 'unreachable',
  P2021: 'missing-schema',
  P2022: 'missing-schema',
  '28P01': 'authentication',
  '28000': 'authentication',
  '3D000': 'missing-schema',
  '42P01': 'missing-schema',
  '57P01': 'unreachable',
  '53300': 'unreachable',
  ECONNREFUSED: 'unreachable',
  ENOTFOUND: 'unreachable',
  ETIMEDOUT: 'timeout',
  ECONNRESET: 'unreachable',
}

export function databaseProblem(error: unknown): DatabaseProblem | null {
  const text = collectText(error).toLowerCase()
  const codes = collectCodes(error)

  if (text.includes('invalid environment configuration') || text.includes('database_url is required')) {
    return 'missing-config'
  }

  for (const code of codes) {
    const problem = CODE_PROBLEM[code]
    if (problem) return problem
  }

  if (text.includes('self-signed certificate') || text.includes('unable to verify the first certificate') || text.includes('ssl')) {
    return 'ssl'
  }
  if (text.includes('timeout') || text.includes('timed out') || text.includes('etimedout')) return 'timeout'
  if (text.includes('password authentication failed') || text.includes('authentication failed')) return 'authentication'
  if (
    (text.includes('relation') || text.includes('table') || text.includes('column')) &&
    text.includes('does not exist')
  ) {
    return 'missing-schema'
  }
  if (
    text.includes("can't reach database") ||
    text.includes('econnrefused') ||
    text.includes('enotfound') ||
    text.includes('connection refused') ||
    text.includes('connect econnreset') ||
    text.includes('tenant or user not found') ||
    text.includes('remaining connection slots')
  ) {
    return 'unreachable'
  }

  if (codes.some((code) => code.startsWith('P1') || code.startsWith('08') || code.startsWith('53') || code.startsWith('57'))) {
    return 'unreachable'
  }

  return null
}

export function isDatabaseUnavailable(error: unknown): boolean {
  return databaseProblem(error) !== null
}

export function databaseProblemText(problem: DatabaseProblem): string {
  switch (problem) {
    case 'missing-config':
      return 'DATABASE_URL is missing or not valid. Set it on the deployment, then redeploy.'
    case 'authentication':
      return 'Postgres refused the username or password in DATABASE_URL.'
    case 'missing-schema':
      return 'The database is reachable, but the tables are not there. Run pnpm db:deploy against DIRECT_URL.'
    case 'timeout':
      return 'The database did not answer in time. Check the pooler host, port, and that the project is not paused.'
    case 'ssl':
      return 'The database connection failed the TLS check. Supabase URLs need sslmode=require.'
    case 'unreachable':
      return 'The app could not open a connection to Postgres. Check DATABASE_URL, the pooler, and that the database is running.'
    default:
      return 'The database query failed before a page could be drawn.'
  }
}

function collectCodes(error: unknown, depth = 0): string[] {
  if (!error || depth > 4) return []
  if (typeof error !== 'object') return []
  const record = error as { code?: unknown; cause?: unknown }
  const codes: string[] = []
  if (typeof record.code === 'string') codes.push(record.code)
  codes.push(...collectCodes(record.cause, depth + 1))
  return codes
}

function collectText(error: unknown, depth = 0): string {
  if (!error || depth > 4) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) return `${error.message} ${collectText(error.cause, depth + 1)}`
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    const cause = (error as { cause?: unknown }).cause
    return `${typeof message === 'string' ? message : ''} ${collectText(cause, depth + 1)}`
  }
  return ''
}

/** Next throws these to redirect or to render not-found. They are not failures. */
export function isNavigationError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('digest' in error)) return false
  const digest = (error as { digest?: unknown }).digest
  if (typeof digest !== 'string') return false
  return (
    digest.startsWith('NEXT_REDIRECT') ||
    digest.startsWith('NEXT_NOT_FOUND') ||
    digest.startsWith('NEXT_HTTP_ERROR_FALLBACK')
  )
}
