import { ROLE_LABELS } from '@/lib/roles'
import type { Role } from '@prisma/client'

/** Subject line for a document email — matches common ERP / Odoo style. */
export function documentEmailSubject(
  singular: string,
  number: string,
  orgName: string,
): string {
  const label = singular.trim() || 'Document'
  const num = number.trim()
  return num ? `${label} #${num} — ${orgName}` : `${label} — ${orgName}`
}

/** Opening line: "Dear Acme team," or a generic fallback. */
export function documentEmailGreeting(partyName: string | null | undefined): string {
  const name = partyName?.trim()
  if (!name) return 'Dear Customer,'
  if (/team$/i.test(name)) return `Dear ${name},`
  return `Dear ${name} team,`
}

/** Short intro naming the attached document. */
export function documentEmailIntro(singular: string, number: string): string {
  const label = singular.trim().toLowerCase() || 'document'
  const num = number.trim()
  if (num) return `Please find the attached ${label} ${num}.`
  return `Please find the attached ${label}.`
}

/** Editable body shown in the Email dialog (signature is appended server-side). */
export function documentEmailBody(input: {
  partyName?: string | null
  singular: string
  number: string
  extraLines?: (string | null | undefined)[]
}): string {
  const lines = [
    documentEmailGreeting(input.partyName),
    '',
    documentEmailIntro(input.singular, input.number),
    ...(input.extraLines ?? []).filter((line): line is string => Boolean(line && line.trim())),
    '',
    'Thanks & Best regards,',
  ]
  return lines.join('\n')
}

export type OrgEmailContact = {
  name: string
  legalName?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
}

/** Plain-text signature: sender name, role label, company contacts. */
export function documentEmailSignatureText(input: {
  senderName: string
  role: Role
  organization: OrgEmailContact
}): string {
  const roleLabel = ROLE_LABELS[input.role] ?? input.role
  const company = input.organization.legalName?.trim() || input.organization.name
  const address = [
    input.organization.addressLine1,
    input.organization.addressLine2,
    [input.organization.city, input.organization.region, input.organization.postalCode]
      .filter(Boolean)
      .join(', '),
    input.organization.country,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)

  const lines = [
    input.senderName.trim() || 'SOM ERP user',
    roleLabel,
    '—',
    company.toUpperCase(),
    ...address,
  ]
  if (input.organization.phone?.trim()) lines.push(`Tel: ${input.organization.phone.trim()}`)
  if (input.organization.email?.trim()) lines.push(`Email: ${input.organization.email.trim()}`)
  if (input.organization.website?.trim()) lines.push(input.organization.website.trim())
  return lines.join('\n')
}

/** HTML signature block for multipart mail. */
export function documentEmailSignatureHtml(input: {
  senderName: string
  role: Role
  organization: OrgEmailContact
}): string {
  const roleLabel = ROLE_LABELS[input.role] ?? input.role
  const company = input.organization.legalName?.trim() || input.organization.name
  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const rows: string[] = [
    `<div style="font-weight:700;color:#1a3d7c">${escape(input.senderName.trim() || 'SOM ERP user')}</div>`,
    `<div style="font-weight:700;color:#1a3d7c">${escape(roleLabel)}</div>`,
    `<div style="margin:10px 0 8px;border-top:1px solid #9aa3ad"></div>`,
    `<div style="font-weight:700;color:#1a4f9c;letter-spacing:0.02em">${escape(company.toUpperCase())}</div>`,
  ]
  const address = [
    input.organization.addressLine1,
    input.organization.addressLine2,
    [input.organization.city, input.organization.region, input.organization.postalCode]
      .filter(Boolean)
      .join(', '),
    input.organization.country,
  ]
    .map((part) => part?.trim())
    .filter(Boolean) as string[]
  for (const line of address) {
    rows.push(`<div style="color:#3d4c5c;font-size:13px">${escape(line)}</div>`)
  }
  if (input.organization.phone?.trim()) {
    rows.push(
      `<div style="color:#3d4c5c;font-size:13px">Tel: ${escape(input.organization.phone.trim())}</div>`,
    )
  }
  if (input.organization.email?.trim()) {
    const mail = input.organization.email.trim()
    rows.push(
      `<div style="font-size:13px">Email: <a href="mailto:${escape(mail)}">${escape(mail)}</a></div>`,
    )
  }
  if (input.organization.website?.trim()) {
    const site = input.organization.website.trim()
    const href = /^https?:\/\//i.test(site) ? site : `https://${site}`
    rows.push(
      `<div style="font-size:13px"><a href="${escape(href)}">${escape(site)}</a></div>`,
    )
  }

  return `<div style="margin-top:16px;font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.45;color:#1f2933">${rows.join('')}</div>`
}

/** Turn the user's plain message into a simple HTML paragraph block. */
export function plainBodyToHtml(body: string): string {
  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  const paragraphs = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
  if (paragraphs.length === 0) return ''
  return paragraphs
    .map(
      (block) =>
        `<p style="margin:0 0 12px;font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2933">${escape(block).replace(/\n/g, '<br/>')}</p>`,
    )
    .join('')
}
