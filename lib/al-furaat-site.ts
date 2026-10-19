/**
 * Al Furaat Plastic Center — public storefront (not SOM ERP).
 *
 * Company contact for the shop in Kismaayo. The ERP product site keeps its own
 * support contact under `lib/marketing-site.ts`.
 */

import {
  mailtoUrl,
  telUrl,
  whatsappUrl,
  type MarketingContact,
} from '@/lib/marketing-site'

export const STORE_NAME = 'Al Furaat Plastic Center'
export const STORE_GROUP = 'Al Furaat Group of Company'
export const STORE_TAGLINE =
  'Plumbing, tools, and building materials for homes and contractors in Kismaayo.'
export const STORE_PATH = '/al-furaat'

export const DEFAULT_STORE_CONTACT: MarketingContact = {
  companyName: STORE_NAME,
  contactName: 'Al Furaat Plastic Center',
  phone: '252617305588',
  email: 'alfuraat.plastic@gmail.com',
  secondaryEmail: 'info@furaat.so',
  address: 'Furaat Store',
  city: 'Kismaayo',
  region: 'Somalia',
  whatsappE164: '252617305588',
}

export type StoreCategory = {
  id: string
  name: string
  nameSo: string
  summary: string
  image: string
  imageAlt: string
  items: string[]
}

export const STORE_HERO_IMAGE = '/al-furaat/hero.jpg'

export const STORE_CATEGORIES: StoreCategory[] = [
  {
    id: 'plumbing',
    name: 'Plumbing',
    nameSo: 'Tuubooyinka & qalabka biyaha',
    summary:
      'Pipes, fittings, valves, tanks, and bathroom hardware for new builds and repairs.',
    image: '/al-furaat/plumbing.jpg',
    imageAlt: 'Blue PVC pipes, elbows, tees, and valves for plumbing supply',
    items: [
      'PVC & PPR pipes',
      'Elbows, tees, unions',
      'Ball valves & taps',
      'Water tanks & connectors',
      'Sinks, mixers, waste kits',
    ],
  },
  {
    id: 'tools',
    name: 'Tools',
    nameSo: 'Qalabka shaqada',
    summary:
      'Hand tools and site essentials for plumbers, builders, and workshop work.',
    image: '/al-furaat/tools.jpg',
    imageAlt: 'Pipe wrenches, cutters, and workshop tools on a workbench',
    items: [
      'Pipe cutters & wrenches',
      'Drill bits & fasteners',
      'Measuring & marking',
      'Safety gear',
      'Workshop consumables',
    ],
  },
  {
    id: 'building',
    name: 'Building materials',
    nameSo: 'Agabka dhismaha',
    summary:
      'Everyday build supplies that keep projects moving — from the yard to the site.',
    image: '/al-furaat/building.jpg',
    imageAlt: 'Building materials including boards, sealants, and drainage supplies',
    items: [
      'Plastic sheets & boards',
      'Sealants & adhesives',
      'Drainage & conduit',
      'Hardware & fixings',
      'Site accessories',
    ],
  },
]

export function storeWhatsAppHref(contact: MarketingContact, text?: string) {
  return whatsappUrl(
    contact.whatsappE164,
    text ??
      `Assalaamu calaykum ${contact.companyName}. Waxaan ka imid website-kiinna — waxaan jeclaan lahaa inaan wax ka weydiiyo plumbing, tools, ama building materials.`,
  )
}

export function storeTelHref(contact: MarketingContact) {
  return telUrl(contact.phone)
}

export function storeMailHref(contact: MarketingContact, subject?: string) {
  return mailtoUrl(contact.email, subject ?? `${STORE_NAME} inquiry`)
}

export function storeOfficeLine(contact: MarketingContact) {
  return [contact.address, contact.city, contact.region]
    .map((part) => part.replace(/^[\s,]+|[\s,]+$/g, '').trim())
    .filter(Boolean)
    .join(', ')
    .replace(/,\s*,+/g, ', ')
}

export function storeMapsHref(contact: MarketingContact) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeOfficeLine(contact))}`
}
