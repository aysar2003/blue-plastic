import { db } from '@/server/db'
import {
  DEFAULT_STORE_CONTACT,
  STORE_NAME,
} from '@/lib/al-furaat-site'
import {
  DEFAULT_MARKETING_CONTACT,
  type MarketingContact,
} from '@/lib/marketing-site'

/**
 * Company / shop contact for the Al Furaat Plastic Center storefront.
 *
 * Prefers the oldest organisation that has a phone or email filled in.
 * Falls back to the curated store default when the database is empty.
 */
export async function getStoreContact(): Promise<MarketingContact> {
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

    if (!org) return DEFAULT_STORE_CONTACT

    const websiteLooksLikeEmail =
      org.website?.includes('@') && !org.website.startsWith('http')

    return {
      companyName: STORE_NAME,
      contactName: org.legalName || DEFAULT_STORE_CONTACT.contactName,
      phone: org.phone || DEFAULT_STORE_CONTACT.phone,
      email: org.email || DEFAULT_STORE_CONTACT.email,
      secondaryEmail: websiteLooksLikeEmail
        ? org.website!.toLowerCase()
        : DEFAULT_STORE_CONTACT.secondaryEmail,
      address: org.addressLine1 || DEFAULT_STORE_CONTACT.address,
      city: org.city || DEFAULT_STORE_CONTACT.city,
      region: org.region || DEFAULT_STORE_CONTACT.region,
      whatsappE164: (org.phone || DEFAULT_STORE_CONTACT.phone).replace(/\D/g, ''),
    }
  } catch {
    return DEFAULT_STORE_CONTACT
  }
}

/** @deprecated Prefer getStoreContact for the shop; SOM ERP uses DEFAULT_MARKETING_CONTACT. */
export async function getMarketingContact(): Promise<MarketingContact> {
  return DEFAULT_MARKETING_CONTACT
}
