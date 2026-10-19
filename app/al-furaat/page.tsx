import { AlFuraatStorefront } from '@/components/al-furaat/storefront'
import { DEFAULT_STORE_CONTACT } from '@/lib/al-furaat-site'
import { withDatabasePage } from '@/lib/page-guard'
import { getStoreContact } from '@/server/services/marketing.service'

export const dynamic = 'force-dynamic'

export default async function AlFuraatPage() {
  return withDatabasePage(async () => {
    const contact = await getStoreContact().catch(() => DEFAULT_STORE_CONTACT)
    return <AlFuraatStorefront contact={contact} />
  })
}
