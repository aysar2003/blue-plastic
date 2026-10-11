import { db } from '@/server/db'
import {
  DEFAULT_MARKETING_CONTACT,
  type MarketingContact,
} from '@/lib/marketing-site'

/**
 * Public contact shown on the marketing site.
 *
 * Prefers the oldest organisation that has a phone or email filled in (the
 * primary Al Furaat company in production). Falls back to the curated default
 * when the database is empty or unreachable for the public page.
 */
export async function getMarketingContact(): Promise<MarketingContact> {
  try {
    const org = await db.organization.findFirst({
      where: {
        OR: [{ phone: { not: null } }, { email: { not: null } }],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        name: true,
        legalName: true,
        phone: true,
        email: true,
        website: true,
        addressLine1: true,
        city: true,
        region: true,
      },
    })

    if (!org) return DEFAULT_MARKETING_CONTACT

    const websiteLooksLikeEmail =
      org.website?.includes('@') && !org.website.startsWith('http')

    return {
      companyName: org.name || DEFAULT_MARKETING_CONTACT.companyName,
      contactName: org.legalName || DEFAULT_MARKETING_CONTACT.contactName,
      phone: org.phone || DEFAULT_MARKETING_CONTACT.phone,
      email: org.email || DEFAULT_MARKETING_CONTACT.email,
      secondaryEmail: websiteLooksLikeEmail
        ? org.website!.toLowerCase()
        : DEFAULT_MARKETING_CONTACT.secondaryEmail,
      address: org.addressLine1 || DEFAULT_MARKETING_CONTACT.address,
      city: org.city || DEFAULT_MARKETING_CONTACT.city,
      region: org.region || DEFAULT_MARKETING_CONTACT.region,
      whatsappE164: (org.phone || DEFAULT_MARKETING_CONTACT.phone).replace(/\D/g, ''),
    }
  } catch {
    return DEFAULT_MARKETING_CONTACT
  }
}
