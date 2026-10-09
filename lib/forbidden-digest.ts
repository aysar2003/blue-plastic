/**
 * Stable id on permission errors. Next forwards `error.digest` to the client
 * error boundary and hides the server message in production, so the page can
 * still tell a denial from a crash.
 */
export const FORBIDDEN_DIGEST = 'FORBIDDEN'
