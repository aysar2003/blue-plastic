/** Built-in SMTP presets for the Organisation outgoing-email form. */

export type SmtpPresetId = 'gmail' | 'outlook' | 'custom'

export type SmtpPreset = {
  id: SmtpPresetId
  label: string
  host: string
  port: number
  secure: boolean
  hint: string
}

export const SMTP_PRESETS: SmtpPreset[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    hint: 'Use a Google App Password (not your normal Gmail password).',
  },
  {
    id: 'outlook',
    label: 'Outlook / Microsoft 365',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    hint: 'Sign-in email and mailbox password (or app password if required).',
  },
  {
    id: 'custom',
    label: 'Custom / domain mail',
    host: '',
    port: 587,
    secure: false,
    hint: 'Host and port from your domain provider (cPanel, Google Workspace SMTP, etc.).',
  },
]

export function smtpPresetById(id: string | null | undefined): SmtpPreset {
  return SMTP_PRESETS.find((p) => p.id === id) ?? SMTP_PRESETS[2]!
}

/** Guess which preset matches saved host/port (for the form default). */
export function matchSmtpPreset(host: string | null | undefined, port: number | null | undefined): SmtpPresetId {
  const h = (host ?? '').trim().toLowerCase()
  const p = port ?? 0
  if (h === 'smtp.gmail.com' && (p === 465 || p === 587)) return 'gmail'
  if ((h === 'smtp.office365.com' || h === 'smtp-mail.outlook.com') && (p === 587 || p === 465)) {
    return 'outlook'
  }
  return 'custom'
}
