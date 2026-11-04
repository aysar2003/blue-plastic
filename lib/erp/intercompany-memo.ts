const PREFIX = '[IC]'

export function withIntercompanyMemo(memo: string | null | undefined, intercompany: boolean): string {
  const text = (memo ?? '').trim()
  if (!intercompany) return text
  if (text.startsWith(PREFIX)) return text
  return text ? `${PREFIX} ${text}` : PREFIX
}

export function isIntercompanyMemo(memo: string | null | undefined): boolean {
  return (memo ?? '').trim().startsWith(PREFIX)
}
