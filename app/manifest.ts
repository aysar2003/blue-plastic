import type { MetadataRoute } from 'next'

import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from '@/lib/product-brand'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${PRODUCT_NAME} POS`,
    short_name: 'SOM POS',
    description: PRODUCT_DESCRIPTION,
    start_url: '/pos',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0b1220',
    theme_color: '#0e7490',
    categories: ['business', 'finance'],
    icons: [
      {
        src: '/icons/pos-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/pos-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
