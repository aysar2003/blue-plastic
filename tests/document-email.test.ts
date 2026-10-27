import { describe, expect, it } from 'vitest'

import {
  documentEmailBody,
  documentEmailGreeting,
  documentEmailIntro,
  documentEmailSignatureHtml,
  documentEmailSignatureText,
  documentEmailSubject,
  plainBodyToHtml,
} from '@/lib/document-email'

describe('documentEmailSubject', () => {
  it('formats sales and purchase kinds like Odoo', () => {
    expect(documentEmailSubject('RFQ', 'RFQ-001', 'Acme')).toBe('RFQ #RFQ-001 — Acme')
    expect(documentEmailSubject('Purchase order', 'PO-12', 'Acme')).toBe(
      'Purchase order #PO-12 — Acme',
    )
    expect(documentEmailSubject('Invoice', 'INV-9', 'Blue Plastic')).toBe(
      'Invoice #INV-9 — Blue Plastic',
    )
  })
})

describe('documentEmailGreeting / intro / body', () => {
  it('greets the party as a team', () => {
    expect(documentEmailGreeting('Al-Furat')).toBe('Dear Al-Furat team,')
    expect(documentEmailGreeting('Al-Furat team')).toBe('Dear Al-Furat team,')
    expect(documentEmailGreeting(null)).toBe('Dear Customer,')
  })

  it('names the attached document', () => {
    expect(documentEmailIntro('RFQ', 'RFQ-001')).toBe('Please find the attached rfq RFQ-001.')
    expect(documentEmailIntro('Invoice', 'INV-1')).toContain('invoice INV-1')
  })

  it('builds an editable body without the signature block', () => {
    const body = documentEmailBody({
      partyName: 'Deeqa',
      singular: 'Purchase order',
      number: 'P24308',
      extraLines: ['Total: $100.00'],
    })
    expect(body).toContain('Dear Deeqa team,')
    expect(body).toContain('Please find the attached purchase order P24308.')
    expect(body).toContain('Total: $100.00')
    expect(body).toContain('Thanks & Best regards,')
    expect(body).not.toContain('Owner')
  })
})

describe('documentEmailSignature', () => {
  const organization = {
    name: 'AL FURAAT GROUP',
    legalName: null,
    addressLine1: 'Balcad Street',
    city: 'Kismaayo',
    phone: '252-617305588',
    email: 'office@example.com',
    website: 'www.example.com',
  }

  it('includes sender name and role label in text', () => {
    const text = documentEmailSignatureText({
      senderName: 'Zakarie Abdisalam',
      role: 'ADMIN',
      organization,
    })
    expect(text).toContain('Zakarie Abdisalam')
    expect(text).toContain('Admin')
    expect(text.indexOf('Zakarie Abdisalam')).toBeLessThan(text.indexOf('—'))
    expect(text.indexOf('—')).toBeLessThan(text.indexOf('AL FURAAT GROUP'))
    expect(text).toContain('Tel: 252-617305588')
    expect(text).toContain('Email: office@example.com')
    expect(text).toContain('Balcad Street')
  })

  it('includes role in HTML signature', () => {
    const html = documentEmailSignatureHtml({
      senderName: 'Zakarie Abdisalam',
      role: 'OWNER',
      organization,
    })
    expect(html).toContain('Zakarie Abdisalam')
    expect(html).toContain('Owner')
    expect(html).toContain('border-top:1px solid #9aa3ad')
    expect(html).toContain('AL FURAAT GROUP')
    expect(html).toContain('Tel: 252-617305588')
    expect(html).toContain('mailto:office@example.com')
  })
})

describe('plainBodyToHtml', () => {
  it('escapes HTML and preserves paragraphs', () => {
    const html = plainBodyToHtml('Hello <team>\n\nLine two')
    expect(html).toContain('Hello &lt;team&gt;')
    expect(html).toContain('Line two')
    expect(html.match(/<p /g)?.length).toBe(2)
  })
})
