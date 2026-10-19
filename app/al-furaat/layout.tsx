import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { STORE_NAME, STORE_TAGLINE } from '@/lib/al-furaat-site'

export const metadata: Metadata = {
  title: {
    absolute: STORE_NAME,
  },
  description: STORE_TAGLINE,
  applicationName: STORE_NAME,
}

export default function AlFuraatLayout({ children }: { children: ReactNode }) {
  return children
}
