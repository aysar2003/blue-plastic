/**
 * @name mentions inside Discuss. Internal company threads — not a Slack workspace.
 */

export const DISCUSS_LEGAL =
  'Internal company channels. Mentions notify people who already have a login here. This is not Slack and is not a public network.'

export function extractMentions(body: string): string[] {
  const found = body.match(/@([a-z0-9._-]{2,40})/gi) ?? []
  const names = found.map((token) => token.slice(1).toLowerCase())
  return [...new Set(names)]
}
